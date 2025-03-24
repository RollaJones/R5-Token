async function checkToken() {
  const tokenAddress = document.getElementById("tokenAddress").value;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Loading...";

  try {
    const proxy = "https://corsproxy.io/?";
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${tokenAddress}`;
    const response = await fetch(proxy + encodeURIComponent(url));
    const data = await response.json();

    if (!data.pair) {
      resultDiv.innerHTML = "<p>Token not found or invalid.</p>";
      return;
    }

    const token = data.pair;
    const score = calculateSafetyScore(token);

    resultDiv.innerHTML = `
      <h2>${token.baseToken.name || "Unknown Token"}</h2>
      <p><strong>Symbol:</strong> ${token.baseToken.symbol}</p>
      <p><strong>Price:</strong> $${parseFloat(token.priceUsd).toFixed(6)}</p>
      <p><strong>Liquidity:</strong> $${parseFloat(token.liquidity.usd).toLocaleString()}</p>
      <p><strong>Volume 24h:</strong> $${parseFloat(token.volume.h24).toLocaleString()}</p>
      <p><strong>Safety Score:</strong> ${score}/100</p>
    `;
  } catch (err) {
    resultDiv.innerHTML = "<p>Error fetching data. Try again.</p>";
  }
}

function calculateSafetyScore(token) {
  let score = 50;
  if (token.liquidity.usd > 20000) score += 15;
  if (token.volume.h24 > 50000) score += 10;
  if (token.baseToken.symbol && token.baseToken.symbol.length < 6) score += 5;
  if (token.priceUsd < 0.01) score -= 5;
  return Math.min(score, 100);
}
