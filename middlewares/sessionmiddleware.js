const session = require('express-session')
const MySQLStore = require('express-mysql-session')(session);

module.exports = function (app) {
  app.set('trust proxy', 1)
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 3600000},
    store: new MySQLStore({
      connectionLimit: 100,
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'Fallenzerd4',
      database: 'auction',
      charset: 'utf8mb4_bin',
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
        }
      }
    }),
  }))
};
