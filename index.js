const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_TOKEN_SECRET);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized token" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized token" });
    }
    req.decode = decode;
    next();
  });
};

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

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decode.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Message" });
      }
      next();
    };

    const usersCollection = client.db("sumCampDB").collection("users");
    const classesCollection = client.db("sumCampDB").collection("classes");
    const instructorsCollection = client
      .db("sumCampDB")
      .collection("instructors");
    const selectedCollection = client.db("sumCampDB").collection("selected");
    const paymentsCollection = client.db("sumCampDB").collection("payments");

    // user related api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decode.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // classes related api
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    // instructors related api
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
    app.get("/selected", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decode.email;
      if (email != decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
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
      res.send({ deleteCount: result.deletedCount });
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (typeof price !== "number" || price < 1) {
        return res.status(400).send({ error: "Invalid price value" });
      }

      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentsCollection.find().toArray();
      res.send(result);
    });
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.selectItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedCollection.deleteMany(query);
      res.send({ insertResult, deleteResult });
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
