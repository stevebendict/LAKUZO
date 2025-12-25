export const LAKUZO_ABI = [
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
