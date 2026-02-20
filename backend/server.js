const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Backend Running!'));

// ======================
// Phishing Detector
// ======================
app.post('/phishing', async (req, res) => {
  try {
    const { emailText } = req.body;
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: `Check if this email is phishing. Give risk score 0-100 and explain why. Email: "${emailText}"` }
      ],
      max_tokens: 150
    });
    const result = response.data.choices[0].message.content;
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Complaint Router
// ======================
app.post('/complaint', async (req, res) => {
  try {
    const { complaintText, studentName } = req.body;
    const aiResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: `Categorize this complaint: Hostel, Mess, Academic, Transport, Other. Assign priority Low/Medium/High. Complaint: "${complaintText}"` }
      ],
      max_tokens: 100
    });
    const aiResult = aiResponse.data.choices[0].message.content;

    // Save in Firebase
    await db.collection('complaints').add({
      studentName,
      complaintText,
      aiResult,
      timestamp: new Date()
    });

    res.json({ result: aiResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Lost & Found (simplified)
// ======================
app.post('/lost', async (req, res) => {
  try {
    const { description, studentName } = req.body;

    // Get all found items
    const foundSnapshot = await db.collection('found_items').get();
    let matches = [];
    foundSnapshot.forEach(doc => {
      const item = doc.data();
      if (description.toLowerCase().includes(item.objectName.toLowerCase())) {
        matches.push({ id: doc.id, ...item });
      }
    });

    // Save lost item
    await db.collection('lost_items').add({
      studentName,
      description,
      timestamp: new Date()
    });

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/found', async (req, res) => {
  try {
    const { objectName, location } = req.body;
    await db.collection('found_items').add({
      objectName,
      location,
      timestamp: new Date()
    });
    res.json({ message: 'Found item saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));