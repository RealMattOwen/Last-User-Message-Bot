import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
	author: {
		required: true,
		type: String
	},
	content: {
		required: true,
		type: String
	},
	timestamp: {
		required: true,
		type: Date
	}
});

export default mongoose.model('Message', messageSchema);