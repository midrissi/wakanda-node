var B = require('backbone');
var utils = require('./utils');

module.exports = B.Model.extend({
	idAttribute: '__KEY',
	dataclass: null,
	__TIMESTAMP: new Date(),
	initialize: function () {
		utils.initialize.apply(this, arguments);
		this.__TIMESTAMP = new Date();
	},
	sync: function(method, model, options) {
		this.connector.sync.apply(this.connector, arguments);
	},
	getKey: function () {
		if(this.id){
			return this.id;
		}

		return this.cid;
	},
	getModifiedAttributes: function () {
		return this.changed;
	},
	getTimeStamp: function () {
		return this.__TIMESTAMP;
	},
	refresh: function () {
		return this.fetch();
	},
	remove: function () {
		return this.destroy();
	},
	getDataClass: function () {
		return this.dataclass;
	}
});