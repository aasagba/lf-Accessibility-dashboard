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

var presentTask = require('../view/presenter/task');

module.exports = route;

// Route definition
function route (app) {
	app.express.get('/client/:client', function (req, res, next) {
		var client = req.params.client;
		//console.log("client url param: " + client);

		app.webservice.tasks.get({lastres: true, client: client}, function (err, tasks) {
			if (err) {
				return next(err);
			}

			res.render('index', {
				tasks: tasks.map(presentTask),
				deleted: (typeof req.query.deleted !== 'undefined'),
				isHomePage: true,
				client: client
			});
		});
	});
}
