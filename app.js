// This file is part of pa11y-dashboard.
// 
// pa11y-dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// pa11y-dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with pa11y-dashboard.  If not, see <http://www.gnu.org/licenses/>.

'use strict';
require('newrelic');
var createClient = require('pa11y-webservice-client-node');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var hbs = require('express-hbs');
var http = require('http');
var pkg = require('./package.json');

module.exports = initApp;

// Initialise the application
function initApp (config, callback) {
	config = defaultConfig(config);

	var webserviceUrl = config.webservice;
	if (typeof webserviceUrl == 'object') {
		webserviceUrl = 'http://' + webserviceUrl.host + ':' + webserviceUrl.port + '/';
	}

	var app = new EventEmitter();
	app.address = null;
	app.express = express();
	app.server = http.createServer(app.express);
	app.webservice = createClient(webserviceUrl);

	// Compression
	app.express.use(express.compress());

	// Public files
	app.express.use(express.static(__dirname + '/public', {
		maxAge: (process.env.NODE_ENV === 'production' ? 604800000 : 0)
	}));

	// General express config
	app.express.disable('x-powered-by');
	app.express.use(express.bodyParser());

	// View engine
	app.express.set('views', __dirname + '/view');
	app.express.engine('html', hbs.express3({
		extname: '.html',
		contentHelperName: 'content',
		layoutsDir: __dirname + '/view/layout',
		partialsDir: __dirname + '/view/partial',
		defaultLayout: __dirname + '/view/layout/default',
	}));
	app.express.set('view engine', 'html');

	// View helpers
	require('./view/helper/date')(hbs.registerHelper);
	require('./view/helper/string')(hbs.registerHelper);
	require('./view/helper/url')(hbs.registerHelper);
	require('./view/helper/number')(hbs.registerHelper);

	// Populate view locals
	app.express.locals({
		lang: 'en',
		year: (new Date()).getFullYear(),
		version: pkg.version,
		repo: pkg.homepage,
		bugtracker: pkg.bugs,
		noindex: config.noindex,
		readonly: config.readonly,
		siteMessage: config.siteMessage
	});

	app.express.use(function (req, res, next) {
		res.locals.isHomePage = (req.path === '/');
		res.locals.host = req.host;
		next();
	});

	// Load routes
	require('./route/index')(app);
	require('./route/task/index')(app);
	require('./route/result/index')(app);
	require('./route/result/download')(app);
	if (!config.readonly) {
		require('./route/new')(app);
		require('./route/task/delete')(app);
		require('./route/task/run')(app);
		require('./route/task/edit')(app);
		require('./route/task/ignore')(app);
		require('./route/task/unignore')(app);
	}

	// Error handling
	app.express.get('*', function (req, res) {
		res.status(404);
		res.render('404');
	});
	app.express.use(function (err, req, res, next) {
		/* jshint unused: false */
		if (err.code === 'ECONNREFUSED') {
			err = new Error('Could not connect to pa11y-webservice');
			console.log(err.message);
		}
		app.emit('route-error', err);
		if (process.env.NODE_ENV !== 'production') {
			res.locals.error = err;
		}
		if (err.code === 'ECONNRESET') {
			err = new Error('socket hang up');
			req.emit(err);
			req._hadError = true;
			console.log("Server Closed!!");

			// Close the server
			app.server.close(function () { console.log('Server closed!'); });
			app.server.unref();

			// Destroy all open sockets
			for (var socketId in sockets) {
				console.log('socket', socketId, 'destroyed');
				sockets[socketId].destroy();
			}
		}
		res.status(500);
		res.render('500');
		exit();
	});

	// Maintain a hash of all connected sockets
	var sockets = {}, nextSocketId = 0;
	app.server.on('connection', function (socket) {
		// Add a newly connected socket
		var socketId = nextSocketId++;
		sockets[socketId] = socket;
		console.log("socket", socketId, 'opened');

		// Remove socket when it closes
		socket.on('close', function () {
			console.log("socket", socketId, 'closed');
			delete sockets[socketId];
		});
	});

	app.server.listen(config.port, function (err) {
		var address = app.server.address();
		app.address = 'http://' + address.address + ':' + address.port;
		callback(err, app);
	});

}

// Get default configurations
function defaultConfig (config) {
	if (typeof config.noindex !== 'boolean') {
		config.noindex = true;
	}
	if (typeof config.readonly !== 'boolean') {
		config.readonly = false;
	}
	return config;
}

// forcefuly exit application
var exit = function exit() {
	setTimeout(function () {
		process.exit(1);
	}, 0);
};