require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const zoomRoutes = require('./routes/zoom');

const app = express();
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connect error', err));

app.use('/api/zoom', zoomRoutes);

app.get('/', (req, res) => res.send('Zoom Scheduler Backend running'));
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend listening on ${port}`));

