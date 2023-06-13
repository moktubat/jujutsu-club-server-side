const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.odqhq4i.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classesCollection = client.db("sumCampDB").collection("classes");
    const instructorsCollection = client
      .db("sumCampDB")
      .collection("instructors");
    const selectedCollection = client.db("sumCampDB").collection("selected");

    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    app.get("/popularClass", async (req, res) => {
      try {
        const popularClass = await classesCollection.find().toArray();
        const sortedData = popularClass.sort((a, b) => b.students - a.students);

        const sixStudents = sortedData.slice(0, 6);

        res.send(sixStudents);
      } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error: " + error.message);
      }
    });

    app.get("/popularInstructor", async (req, res) => {
      try {
        const popularInstructor = await instructorsCollection.find().toArray();
        const sortedData = popularInstructor.sort(
          (a, b) => b.students - a.students
        );

        const sixInstructor = sortedData.slice(0, 6);

        res.send(sixInstructor);
      } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error: " + error.message);
      }
    });

    // selected classes api
    app.get("/selected", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/selected", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await selectedCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("summer camp is running");
});

app.listen(port, () => {
  console.log(`summer camp are running on port ${port}`);
});
