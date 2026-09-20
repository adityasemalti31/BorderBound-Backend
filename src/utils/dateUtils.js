// /**
//  * Utility for BorderBound competition phase and fee calculations.
//  */

// // Default Competition Dates (Year independent or dynamic based on config)
// // Registration Phase 1: 5 Oct - 19 Oct (₹499)
// // Registration Phase 2: 20 Oct - 5 Nov (₹1,499)
// // Voting Period: 15 Oct - 15 Nov

// const getRegistrationFeeInfo = (currentDate = new Date(), config = null) => {
//   if (config && config.registrationStatusOverride === "force_closed") {
//     return {
//       isClosed: true,
//       reason: "Registration is manually closed by organizers.",
//       amount: 0,
//     };
//   }
//   if (config && config.registrationStatusOverride === "force_open") {
//     const fee = config.regFeePhase1 || 499;
//     return {
//       isClosed: false,
//       phase: "OVERRIDE_OPEN",
//       amount: fee,
//       deadline: config.regEnd,
//     };
//   }

//   const year = currentDate.getFullYear();

//   // Custom or standard dates
//   // const phase1Start = config?.regPhase1Start ? new Date(config.regPhase1Start) : new Date(year, 9, 5, 0, 0, 0); // 5 Oct
//   const phase1Start = config?.regPhase1Start
//     ? new Date(config.regPhase1Start)
//     : new Date(year, 8, 16, 0, 0, 0); // 16 Sept
//   const phase2Start = config?.regPhase2Start
//     ? new Date(config.regPhase2Start)
//     : new Date(year, 9, 20, 0, 0, 0); // 20 Oct
//   const regEnd = config?.regEnd
//     ? new Date(config.regEnd)
//     : new Date(year, 10, 5, 23, 59, 59); // 5 Nov

//   if (currentDate < phase1Start) {
//     return {
//       isClosed: true,
//       reason: `Registration opens on ${phase1Start.toLocaleDateString("en-IN")}`,
//       amount: 0,
//       opensAt: phase1Start,
//     };
//   }

//   if (currentDate > regEnd) {
//     return {
//       isClosed: true,
//       reason: "Registration officially closed on 5 November",
//       amount: 0,
//     };
//   }

//   if (currentDate >= phase1Start && currentDate < phase2Start) {
//     return {
//       isClosed: false,
//       phase: "PHASE_1",
//       phaseName: "Early Bird Registration (5 Oct – 19 Oct)",
//       amount: config?.regFeePhase1 || 499,
//       nextPhaseAt: phase2Start,
//       nextAmount: config?.regFeePhase2 || 1499,
//     };
//   }

//   return {
//     isClosed: false,
//     phase: "PHASE_2",
//     phaseName: "Standard Registration (20 Oct – 5 Nov)",
//     amount: config?.regFeePhase2 || 1499,
//     closesAt: regEnd,
//   };
// };

// const getVotingStatusInfo = (currentDate = new Date(), config = null) => {
//   if (config && config.votingStatusOverride === "force_closed") {
//     return { isOpen: false, reason: "Voting is manually closed or paused." };
//   }
//   if (config && config.votingStatusOverride === "force_open") {
//     return { isOpen: true, phase: "OVERRIDE_OPEN" };
//   }

//   const year = currentDate.getFullYear();
//   const votingStart = config?.votingStart
//     ? new Date(config.votingStart)
//     : new Date(year, 9, 15, 0, 0, 0); // 15 Oct
//   const votingEnd = config?.votingEnd
//     ? new Date(config.votingEnd)
//     : new Date(year, 10, 15, 23, 59, 59); // 15 Nov

//   if (currentDate < votingStart) {
//     return {
//       isOpen: false,
//       reason: `Public voting begins on ${votingStart.toLocaleDateString("en-IN")}`,
//       opensAt: votingStart,
//     };
//   }

//   if (currentDate > votingEnd) {
//     return {
//       isOpen: false,
//       reason: "Public voting closed on 15 November",
//       closedAt: votingEnd,
//     };
//   }

//   return {
//     isOpen: true,
//     phase: "PUBLIC_VOTING",
//     closesAt: votingEnd,
//     unitPrice: config?.voteUnitPrice || 5,
//   };
// };

// module.exports = {
//   getRegistrationFeeInfo,
//   getVotingStatusInfo,
// };











/**
 * Utility for BorderBound competition phase and fee calculations.
 */

// Registration Phase 1: 16 Sept - 19 Oct (₹499)
// Registration Phase 2: 20 Oct - 5 Nov (₹1,499)
// Voting Period: 15 Oct - 15 Nov

const getRegistrationFeeInfo = (currentDate = new Date(), config = null) => {
  if (config && config.registrationStatusOverride === "force_closed") {
    return {
      isClosed: true,
      reason: "Registration is manually closed by organizers.",
      amount: 0,
    };
  }

  if (config && config.registrationStatusOverride === "force_open") {
    const fee = config.regFeePhase1 || 499;

    return {
      isClosed: false,
      phase: "OVERRIDE_OPEN",
      amount: fee,
      deadline: config.regEnd,
    };
  }

  const year = currentDate.getFullYear();

  // Default registration dates
  const phase1Start = new Date(year, 8, 16, 0, 0, 0); // 16 September
  const phase2Start = new Date(year, 9, 20, 0, 0, 0); // 20 October
  const regEnd = new Date(year, 10, 5, 23, 59, 59); // 5 November

  if (currentDate < phase1Start) {
    return {
      isClosed: true,
      reason: `Registration opens on ${phase1Start.toLocaleDateString(
        "en-IN"
      )}`,
      amount: 0,
      opensAt: phase1Start,
    };
  }

  if (currentDate > regEnd) {
    return {
      isClosed: true,
      reason: "Registration officially closed on 5 November",
      amount: 0,
      closedAt: regEnd,
    };
  }

  if (currentDate >= phase1Start && currentDate < phase2Start) {
    return {
      isClosed: false,
      phase: "PHASE_1",
      phaseName: "Early Bird Registration (16 Sept – 19 Oct)",
      amount: config?.regFeePhase1 || 499,
      nextPhaseAt: phase2Start,
      nextAmount: config?.regFeePhase2 || 1499,
    };
  }

  return {
    isClosed: false,
    phase: "PHASE_2",
    phaseName: "Standard Registration (20 Oct – 5 Nov)",
    amount: config?.regFeePhase2 || 1499,
    closesAt: regEnd,
  };
};

const getVotingStatusInfo = (currentDate = new Date(), config = null) => {
  if (config && config.votingStatusOverride === "force_closed") {
    return {
      isOpen: false,
      reason: "Voting is manually closed or paused.",
    };
  }

  if (config && config.votingStatusOverride === "force_open") {
    return {
      isOpen: true,
      phase: "OVERRIDE_OPEN",
    };
  }

  const year = currentDate.getFullYear();

  const votingStart = new Date(year, 9, 15, 0, 0, 0); // 15 October
  const votingEnd = new Date(year, 10, 15, 23, 59, 59); // 15 November

  if (currentDate < votingStart) {
    return {
      isOpen: false,
      reason: `Public voting begins on ${votingStart.toLocaleDateString(
        "en-IN"
      )}`,
      opensAt: votingStart,
    };
  }

  if (currentDate > votingEnd) {
    return {
      isOpen: false,
      reason: "Public voting closed on 15 November",
      closedAt: votingEnd,
    };
  }

  return {
    isOpen: true,
    phase: "PUBLIC_VOTING",
    closesAt: votingEnd,
    unitPrice: config?.voteUnitPrice || 5,
  };
};

module.exports = {
  getRegistrationFeeInfo,
  getVotingStatusInfo,
};