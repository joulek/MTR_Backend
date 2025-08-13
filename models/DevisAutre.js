// models/DevisAutre.js
import mongoose from "mongoose";
import { devisBase } from "./_devisBase.js";

const spec = new mongoose.Schema({
  titre:       { type: String, required: true },
  description: { type: String, required: true },
}, { _id:false });

const schema = new mongoose.Schema({});
schema.add(devisBase);
schema.add({ 
  spec,
  demandePdf: {
    data: Buffer,
    contentType: String
  }
});

export default mongoose.model("DemandeDevisAutre", schema);
