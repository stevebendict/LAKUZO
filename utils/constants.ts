// frontend/utils/constants.ts

// 1. Your Base Mainnet Contract Address (Deployed Today)
export const LAKUZO_CONTRACT_ADDRESS = "0xBbCbB83018C531012848cf2c65b47ccA3942fD9B";

// 2. The Complete ABI (Includes Voting AND Subscriptions)
export const LAKUZO_ABI = [
  // --- SUBSCRIPTION FUNCTIONS ---
  {
    "inputs": [],
    "name": "subscribeMonthly",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "subscribeAnnually",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_user", "type": "address" }],
    "name": "isPro",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  // --- PRICING VIEWS ---
  {
    "inputs": [],
    "name": "monthlyRate",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "annualRate",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // --- VOTING FUNCTIONS ---
  {
    "inputs": [
      { "internalType": "string", "name": "_marketId", "type": "string" },
      { "internalType": "bool", "name": "_isYes", "type": "bool" }
    ],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // --- EVENTS ---
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "newExpiry", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "plan", "type": "string" }
    ],
    "name": "SubscriptionAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "string", "name": "marketId", "type": "string" },
      { "indexed": false, "internalType": "bool", "name": "isYes", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "weight", "type": "uint256" }
    ],
    "name": "VoteCast",
    "type": "event"
  }
] as const;
