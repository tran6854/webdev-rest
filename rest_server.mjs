import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';
import { default as cors } from 'cors';


const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');
//const db_filename = path.join(__dirname, 'db', 'stpaul_crime_copy.sqlite3');

const port = 8001;

let app = express();
app.use(express.json());
app.use(cors());

/********************************************************************
 ***   DATABASE FUNCTIONS                                         *** 
 ********************************************************************/
// Open SQLite3 database (in read-write mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Create Promise for SQLite3 database SELECT query 
function dbSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

// Create Promise for SQLite3 database INSERT or DELETE query
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function codeRangeInstant(range){
    let codeRange = range.split('-');
    let sql = '';
    if(codeRange[0].toLowerCase() == 'x'){
        sql += "code <= ?";
        return {sql: sql, paramAmt: 1, param: codeRange[1]};
    }
    else if(codeRange[1].toLowerCase() == 'x'){
        sql += "code >= ?";
        return {sql: sql, params: 1, param: codeRange[0]};
    }
    sql += 'code >= ? AND code <= ?';
    return {sql: sql, paramAmt: 2, params: [parseInt(codeRange[0]), parseInt(codeRange[1])]}
}









/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes (COMPLETED)
//EX: http://localhost:8000/codes?code=10
//EX: http://localhost:8000/codes?code_range=x-200,300-350,415-500,800-x
app.get('/codes', (req, res) => {
    //console.log(req.query); // query object (key-value pairs after the ? in the url)

    let sql = 'SELECT code, incident_type as type FROM Codes';
    let params = [];

    if(req.query.hasOwnProperty('code')){
        let codes = req.query.code.split(',');
        sql += ' WHERE code = ?';
        params.push(parseInt(codes[0]));
        for(let i=1; i<codes.length; i++){
            sql += ' OR code = ?';
            params.push(parseInt(codes[i]));
        }
    }else if(req.query.hasOwnProperty('code_range')){
        let codeRange = req.query.code_range.split(',');
        sql += ' WHERE ';
        let count = 0;
        for(let i=0; i<codeRange.length; i++){
            let codeInfo = codeRangeInstant(codeRange[i]);
            if(count != 0){
                sql += ' OR ';
            }
            sql += codeInfo.sql;
            if(codeInfo.paramAmt == 2){
                params.push(codeInfo.params[0]);
                params.push(codeInfo.params[1]);
            }else{
                params.push(codeInfo.param);
            }
            count++;
        }
    }
    //Order from least to greatest
    sql += " ORDER BY code;"
    console.log(sql);
    console.log('PARAM: ', params);

    dbSelect(sql, params)
    .then(rows=>{
        console.log(rows);
        res.status(200).type('json').send(rows);
    }).catch((error)=>{
        res.status(500).type('txt').send(error);
    });
});






// GET request handler for neighborhoods (COMPLETED)
//EX: http://localhost:8000/neighborhoods?id=11,14
app.get('/neighborhoods', (req, res) => {
    //console.log(req.query); // query object (key-value pairs after the ? in the url)
    let sql = 'SELECT neighborhood_number as id, neighborhood_name as name FROM Neighborhoods';
    let params = [];
    if(req.query.hasOwnProperty('id')){
        let ids = req.query.id.split(',');
        sql += ' WHERE neighborhood_number = ?';
        params.push(parseInt(ids[0]));
        for(let i=1; i<ids.length; i++){
            sql += ' OR neighborhood_number = ?';
            params.push(parseInt(ids[i]));
        }
    }
    sql += " ORDER BY id;"
    //console.log(sql);
    //console.log('PARAM: ', params);

    dbSelect(sql, params)
    .then(rows=>{
        console.log(rows);
        res.status(200).type('json').send(rows);
    }).catch((error)=>{
        res.status(500).type('txt').send(error);
    });
});





// GET request handler for crime incidents (COMPLETED)
//EX: http://localhost:8000/incidents?start_date=2014-08-14&end_date=2014-08-20&code=600,641&limit=50
app.get('/incidents', (req, res) => {
    //console.log(req.query); // query object (key-value pairs after the ? in the url)
    let sql = 'SELECT case_number, date(date_time) AS date, time(date_time) AS time, code, incident, police_grid, neighborhood_number, block FROM Incidents';
    let params = [];
    let limit = 1000;
    let count = 0;
    if(req.query.hasOwnProperty('start_date')){
        sql += count == 0 ? ' WHERE date(date_time) >= ?': ' AND date(date_time) >= ?';
        params.push(req.query.start_date);
        count++;
    }

    if(req.query.hasOwnProperty('end_date')){
        sql += count == 0 ? ' WHERE date(date_time) <= ?': ' AND date(date_time) <= ?';
        params.push(req.query.end_date);
        count++;
    }

    if(req.query.hasOwnProperty('neighborhood')){
        let neighborhoods = req.query.neighborhood.split(',');
        sql += count == 0 ? ' WHERE (neighborhood_number = ?': ' AND (neighborhood_number = ?';
        params.push(parseInt(neighborhoods[0]));
        for(let i=1; i<neighborhoods.length; i++){
            sql += ' OR neighborhood_number = ?';
            params.push(parseInt(neighborhoods[i]));
        }
        sql += ')'
        count++;
    }

    if(req.query.hasOwnProperty('code')){
        let codes = req.query.code.split(',');
        sql += count == 0 ? ' WHERE (code = ?': ' AND (code = ?';
        params.push(parseInt(codes[0]));
        for(let i=1; i<codes.length; i++){
            sql += ' OR code = ?';
            params.push(parseInt(codes[i]));
        }
        count++;
        sql += ')'
    }

    if(req.query.hasOwnProperty('grid')){
        let grids = req.query.grid.split(',');
        sql += count == 0 ? ' WHERE (police_grid = ?': ' AND (police_grid = ?';
        params.push(parseInt(grids[0]));
        for(let i=1; i<grids.length; i++){
            sql += ' OR police_grid = ?';
            params.push(parseInt(grids[i]));
        }
        count++;
        sql += ')'
    }

    if(req.query.hasOwnProperty('limit')){
        limit = parseInt(req.query.limit);
    }
    params.push(limit);
    sql += ' ORDER BY date_time DESC LIMIT ?';

    //console.log(sql);
    //console.log('PARAM: ', params);
    
    dbSelect(sql, params)
    .then(rows=>{
        logJSON(rows);
        res.status(200).type('json').send(rows);
    }).catch((error)=>{
        res.status(500).type('txt').send(error);
    });
});





// PUT request handler for new crime incident (NEED REVIEW)
// curl -X PUT "http://localhost:8000/new-incident" -H "Content-Type: application/json" -d "{\"case_number\": 24199733, \"date\": \"11-18-2023\", \"time\": \"20:48:53\", \"code\": 300, \"incident\": \"Stole my heart\", \"police_grid\": 119, \"neighborhood_number\": 1, \"block\": \"4XX LUELLA ST\"}"
app.put('/new-incident', (req, res) => {
    console.log(req.body); // uploaded data

    let sql = "INSERT INTO Incidents (case_number, date_time, code, incident, police_grid, neighborhood_number, block) VALUES (";
    let params = [];
    switch(true){
        case !req.body.hasOwnProperty('case_number'):
        case !(req.body.hasOwnProperty('date') && req.body.hasOwnProperty('time')):
        case !req.body.hasOwnProperty('code'):
        case !req.body.hasOwnProperty('incident'):
        case !req.body.hasOwnProperty('police_grid'):
        case !req.body.hasOwnProperty('neighborhood_number'):
        case !req.body.hasOwnProperty('block'):
            throw 'Missing a column'
        default:
            sql += '?, ?, ?, ?, ?, ?, ?)'
            params.push(req.body.case_number);
            params.push(`${req.body.date}T${req.body.time}`);
            params.push(req.body.code);
            params.push(req.body.incident);
            params.push(req.body.police_grid);
            params.push(req.body.neighborhood_number);
            params.push(req.body.block);
            break;
    }

    // console.log(sql);

    // build SELECT query
    let sqlCheck = "SELECT * FROM Incidents WHERE case_number = ?";

    // console.log(sqlCheck);
    // console.log('PARAM: ', params);

    // check if row exists
    dbSelect(sqlCheck, [parseInt(req.body.case_number)])
    .then((rows) => {
        // console.log(rows)
        if (rows.length !== 0) {
            throw `Incident for case number ${req.body.case_number} already exists in the database.`
        }
        // insert into database
        return dbRun(sql, params)
    })
    .then(() => {
        console.log('Insert successful');
        res.status(200).type('txt').send('OK');
    })
    .catch((error) => {
        console.log(error)
        console.log('Insert NOT successful');
        res.status(500).type('txt').send(error);
    });
});





// DELETE request handler for new crime incident (COMPLETED)
//http://localhost:8000/remove-incident
app.delete('/remove-incident', (req, res) => {
    //console.log(req.body); // uploaded data

    let sql = 'DELETE FROM Incidents';
    let params = [];

    let sqlCheck;
    if(req.body.hasOwnProperty('case_number')){
        params.push(req.body['case_number']);
        sql += ` WHERE case_number = ?`;
        sqlCheck = `SELECT case_number FROM Incidents WHERE case_number = ?`;
    }
    //console.log(sql);
    //console.log('PARAM: ', params);

    //Checking to see if the row exist
    dbSelect(sqlCheck, params)
    .then(rows=>{
        console.log("It exist...: "+rows);
        if (rows.length !== 0){
            console.log("It is true they say");
            dbRun(sql, params)
            .then(()=>{
                res.status(200).type('txt').send('It DOES exist, but not anymore :)');
            }).catch((error)=>{
                res.status(500).type('txt').send('It does not exist');
            });
        }else{
            res.status(500).type('txt').send('It does not exist at all');
        }
    }).catch((error)=>{
        res.status(500).type('txt').send(error);
    });

});





//TEST FUNCTION SO YOU CAN SEE JSON EASIER (ITS IN CONSOLE)
function logJSON(json){
    let rows = '';
    const t = '   '; //using t instead of \t because the space looks too wide
    console.log('[');
    json.forEach(row => {
        rows += t+'{\n';
        Object.keys(row).forEach(key=>{
            rows += t+t+'"'+key+'": "'+row[key]+'"\n';
        });
        rows += t+'},\n';
    });
    console.log(rows);
    console.log(']');
}











/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
