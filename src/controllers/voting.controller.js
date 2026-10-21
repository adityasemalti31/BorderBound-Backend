
const FRONTEND_URL =
  process.env.FRONTEND_URL 

const {
  getVotingPackages,
  createVoteOrder,
  verifyVotePayment,
} = require("../services/voting.service");

const getClientIp = (req) => {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    "0.0.0.0"
  );
};

const isPayURedirectRequest = (req) => {
  const accept =
    req.headers.accept || "";

  const contentType =
    req.headers["content-type"] || "";

  return (
    accept.includes("text/html") ||
    contentType.includes(
      "application/x-www-form-urlencoded"
    )
  );
};

const getContestantRedirectPath = (
  contestantId
) => {
  return contestantId
    ? `/contestant/${encodeURIComponent(
        contestantId
      )}`
    : "/leaderboard";
};

const fetchVotingPackages = async (
  req,
  res
) => {
  try {
    const data = await getVotingPackages();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Fetch voting packages error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch voting packages.",
    });
  }
};

const initiateVoteOrder = async (
  req,
  res
) => {
  try {
    const {
      contestantId,
      votesCount,
    } = req.body || {};

    const ipAddress =
      getClientIp(req);

    const userAgent =
      req.headers["user-agent"] || "";

    const voterUserId =
      req.user?._id || null;

    const orderData =
      await createVoteOrder({
        contestantId,
        votesCount: Number(votesCount),
        voterUserId,
        ipAddress,
        userAgent,
      });

    return res.status(200).json({
      success: true,
      message:
        "Vote payment order created successfully.",
      data: orderData,
    });
  } catch (error) {
    console.error(
      "Initiate vote order error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to create vote payment order.",
    });
  }
};

const confirmVotePayment = async (
  req,
  res
) => {
  try {
    const voterIp =
      getClientIp(req);

    const result =
      await verifyVotePayment({
        ...(req.body || {}),
        voterIp,
      });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Confirm vote payment error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Payment verification failed.",
    });
  }
};

// const handlePayUVotingSuccess = async (
//   req,
//   res
// ) => {
//   const body = req.body || {};

//   try {
//     const voterIp =
//       getClientIp(req);

//     const result =
//       await verifyVotePayment({
//         ...body,
//         voterIp,
//       });

//     const contestantId =
//       body.udf3 || "";

//     const votesCount =
//       body.udf4 || "";

//     if (
//       isPayURedirectRequest(req)
//     ) {
//       const redirectPath =
//         getContestantRedirectPath(
//           contestantId
//         );

//       const params =
//         new URLSearchParams({
//           voting: "success",
//           ...(votesCount
//             ? {
//                 votes: String(
//                   votesCount
//                 ),
//               }
//             : {}),
//           ...(body.txnid
//             ? {
//                 txnid: String(
//                   body.txnid
//                 ),
//               }
//             : {}),
//         });

//       return res.redirect(
//         `${FRONTEND_URL}${redirectPath}?${params.toString()}`
//       );
//     }

//     return res.status(200).json(
//       result
//     );
//   } catch (error) {
//     console.error(
//       "PayU voting success callback error:",
//       error
//     );

//     const contestantId =
//       body.udf3 || "";

//     if (
//       isPayURedirectRequest(req)
//     ) {
//       const redirectPath =
//         getContestantRedirectPath(
//           contestantId
//         );

//       /*
//        * Do NOT expose internal error.message
//        * in the redirect URL.
//        */
//       return res.redirect(
//         `${FRONTEND_URL}${redirectPath}?voting=failed&reason=Payment%20verification%20failed`
//       );
//     }

//     return res.status(400).json({
//       success: false,
//       message:
//         error.message ||
//         "Payment verification failed.",
//     });
//   }
// };

const handlePayUVotingSuccess = async (req, res) => {
  const body = req.body || {};
  const txnid = String(body.txnid || "");
  const redirectRequest = isPayURedirectRequest(req);

  try {
    const voterIp = getClientIp(req);

    const result = await verifyVotePayment({
      ...body,
      voterIp,
    });

    console.info("PayU voting payment verified:", {
      txnid,
      contestantId: result.contestant?.id || null,
      transactionId: result.transactionId || null,
      success: result.success,
    });

    if (redirectRequest) {
      const contestantId =
        result.contestant?.id || body.udf3 || "";

      const redirectPath =
        getContestantRedirectPath(contestantId);

      const params = new URLSearchParams({
        voting: "success",
        ...(body.udf4
          ? { votes: String(body.udf4) }
          : {}),
        ...(txnid ? { txnid } : {}),
      });

      return res.redirect(
        `${FRONTEND_URL}${redirectPath}?${params.toString()}`
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("PayU voting success callback error:", {
      txnid,
      status: body.status || null,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code || null,
      errorLabels: error.errorLabels || [],
      stack: error.stack,
    });

    if (redirectRequest) {
      const contestantId = body.udf3 || "";
      const redirectPath =
        getContestantRedirectPath(contestantId);

      const params = new URLSearchParams({
        voting: "pending",
        ...(txnid ? { txnid } : {}),
      });

      return res.redirect(
        `${FRONTEND_URL}${redirectPath}?${params.toString()}`
      );
    }

    return res.status(500).json({
      success: false,
      pending: true,
      txnid: txnid || null,
      message:
        "Payment verification could not be completed. Please check the payment status before retrying.",
    });
  }
};

const handlePayUVotingFailure = async (
  req,
  res
) => {
  const body = req.body || {};

  try {
    /*
     * PayU failure callback itself does not allocate votes.
     *
     * If you want complete failure records, payment.service /
     * a dedicated failure handler should persist the callback.
     *
     * We intentionally do not call verifyVotePayment here
     * because a failed PayU callback is not a successful
     * financial settlement.
     */

    const contestantId =
      body.udf3 || "";

    if (
      isPayURedirectRequest(req)
    ) {
      const redirectPath =
        getContestantRedirectPath(
          contestantId
        );

      return res.redirect(
        `${FRONTEND_URL}${redirectPath}?voting=failed&reason=Payment%20cancelled%20or%20failed`
      );
    }

    return res.status(400).json({
      success: false,
      message:
        "PayU voting payment failed.",
    });
  } catch (error) {
    console.error(
      "PayU voting failure callback error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        "PayU voting payment failed.",
    });
  }
};

module.exports = {
  fetchVotingPackages,
  initiateVoteOrder,
  confirmVotePayment,
  handlePayUVotingSuccess,
  handlePayUVotingFailure,
};
