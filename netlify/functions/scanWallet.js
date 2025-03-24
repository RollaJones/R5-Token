export async function handler(event) {
  try {
    const { address } = JSON.parse(event.body);

    // Define both token programs to scan
    const tokenPrograms = [
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL
      "TokenzQd8v8CecqFEZs94TSvTsTdNuGz7pkPjzh9FJ"   // Token-2022
    ];

    let allTokens = [];

    for (const programId of tokenPrograms) {
      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            address,
            { programId },
            { encoding: "jsonParsed" }
          ]
        })
      });

      const result = await response.json();

      if (result?.result?.value?.length > 0) {
        allTokens = allTokens.concat(result.result.value);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ tokens: allTokens })
    };
  } catch (error) {
    console.error("Error in scanWallet function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
}
