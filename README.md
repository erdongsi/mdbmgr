# mdbmgr (dismdbmgr and repmdbmgr)
A simple mongodb manager supporting distribution and replset mongodbs.

# How to code?
Key codes of example_mdbmgr.js:

    const dismdbmgr = require("./src/dismdbmgr");

    let auth_info = {user:"reader",password:"reader'spassworld",authMechanism:"DEFAULT",authSource:"authSourceDatabase"};
    let urls = ["localhost:27017","localhost2:27018"]

    let dismod = new dismdbmgr();
    dismod.init(urls, (e,r)=>{
        if (e) {
            helper.logRed("[disdblogs] e:", e.message);
        } else {
            helper.logGreen("[disdblogs] connect",urls,"success.");

            let sort = {_id:1};    //null
            let skip = 0;            //null
            let limit = 10;        //null
            let db_name = "db_name";
            let col_name = "col_name";
            let query = {};
            let projection = {};

            dismod.find(null, db_name, col_name, query, projection, sort, skip, limit, (e_find, r_find)=>{
                if (e_find) {
                    helper.logRed("[disdblogs] disdbmgr.find() e_find:", e_find.message);
                    m.error = e_find.message;
                } else {
                    helper.log("[disdblogs] disdbmgr.find() r_find:", r_find.length);
                    r_find.forEach((f,i)=>{
                        helper.log(i, f._id);
                    });
                }
            });
        }
    }, auth_info);


# How to run it?
Install node.js first.

windows>node example_mdbmgr.js

linux>nohup node example_mdbmgr.js </dev/null >/dev/null 2>err.error &


