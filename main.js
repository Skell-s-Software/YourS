/* Codigo del servidor */

const express = require('express');

const server = express();

server.use(express.static(`${__dirname}/public`));

server.get("/", (requery, response) => {
     response.sendFile(`${__dirname}/index.html`, (err) => {
          if (err) {
               console.log("Error: " + err.message);
	       response.end(err.message);
          }
     });
});

server.listen('8000', '0.0.0.0', () => {
     console.log("Servidor activo en: http://localhost:8000");
});
