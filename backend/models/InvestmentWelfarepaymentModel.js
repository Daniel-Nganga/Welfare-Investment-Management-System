const mongose = require("mongoose");

const paymentSchema = new mongose.Schema(
  {
    member: {
      type: mongose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["Investment", "Welfare"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Mpesa"],
      required: true,
    },
    confirmationCode: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);
const Payment = mongose.model("Payment", paymentSchema);

module.exports = Payment;
