window.onload = getTopTokens;

async function checkToken(tokenAddress = null) {
  const inputAddress = document.getElementById("tokenAddress").value;
  const address = tokenAddress || inputAddress.trim();
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Looking up token...";

  try {
    const url = `https://public-api.birdeye.so/public/token/${address}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.data || !data.data.symbol) {
      resultDiv.innerHTML = "<p>Token not found or invalid address.</p>";
      return;
    }

    const token = data.data;
    const score = birdeyeSafetyScore(token);

    resultDiv.innerHTML = `
      <h2>${token.name || "Unknown Token"}</h2>
      <p><strong>Symbol:</strong> ${token.symbol}</p>
      <p><strong>Price:</strong> $${parseFloat(token.price_usd).toFixed(6)}</p>
      <p><strong>Liquidity:</strong> $${parseFloat(token.liquidity_usd || 0).toLocaleString()}</p>
      <p><strong>Volume 24h:</strong> $${parseFloat(token.volume_24h || 0).toLocaleString()}</p>
      <p><strong>Safety Score:</strong> ${score}/100</p>
    `;

    if (score < 60) {
      resultDiv.innerHTML += `
        <div style="background: #ffe4e1; padding: 1rem; margin-top: 1rem;">
          <h3 style="color: #d32f2f;">Red Flags</h3>
          <ul>
            ${token.liquidity_usd < 1000 ? "<li>Low liquidity</li>" : ""}
            ${token.volume_24h < 5000 ? "<li>Low trading volume</li>" : ""}
          </ul>
        </div>
      `;
    }

  } catch (err) {
    console.error("Error checking token:", err);
    resultDiv.innerHTML = "<p>Error fetching token data. Please try again.</p>";
  }
}

function birdeyeSafetyScore(token) {
  let score = 60;
  if (token.liquidity_usd > 20000) score += 20;
  if (token.volume_24h > 50000) score += 10;
  if (token.symbol && token.symbol.length < 6) score += 5;
  return Math.min(score, 100);
}

async function getTopTokens() {
  const topDiv = document.getElementById("topTokens");
  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/solana");
    const data = await res.json();
    const top10 = data.pairs
      .filter(p => p.liquidity.usd > 1000)
      .sort((a, b) => b.volume.h24 - a.volume.h24)
      .slice(0, 10);

    topDiv.innerHTML = top10
      .map(
        (token, i) => `
        <div style="margin-bottom: 1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem;">
          <strong>${i + 1}. ${token.baseToken.symbol || "Unknown"}</strong> - 
          $${parseFloat(token.priceUsd).toFixed(6)}<br/>
          Liquidity: $${parseFloat(token.liquidity.usd).toLocaleString()}<br/>
          Volume 24h: $${parseFloat(token.volume.h24).toLocaleString()}<br/>
          <button onclick="checkToken('${token.baseToken.address}')">Scan</button>
        </div>
      `
      )
      .join("");
  } catch (err) {
    topDiv.innerHTML = "Failed to load trending tokens.";
  }
}

async function scanWallet() {
  const address = document.getElementById("walletAddress").value;
  const walletResult = document.getElementById("walletResult");
  walletResult.innerHTML = "Scanning wallet...";

  try {
    const response = await fetch("/.netlify/functions/scanWallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });

    const data = await response.json();
    const tokens = data.tokens;

    if (!tokens || tokens.length === 0) {
      walletResult.innerHTML = "<p>No tokens found in this wallet (SPL or Token-2022).</p>";
      return;
    }

    const validTokens = tokens.filter(t => {
      const amount = parseFloat(t.account.data.parsed.info.tokenAmount.amount);
      return amount > 0;
    });

    if (validTokens.length === 0) {
      walletResult.innerHTML = "<p>Wallet has only zero-balance or unscannable tokens.</p>";
      return;
    }

    const topTokens = validTokens.slice(0, 10);
    let html = `<p>Found ${topTokens.length} tokens. Checking safety...</p>`;
    let badTokenCount = 0;

    for (const item of topTokens) {
      const tokenAddress = item.account.data.parsed.info.mint;
      console.log("Scanning token:", tokenAddress);
      html += `<div style="margin: 1rem 0;"><strong>${tokenAddress}</strong><br/>`;

      try {
        const url = `https://public-api.birdeye.so/public/token/${tokenAddress}`;
        const res = await fetch(url);
        const tokenData = await res.json();

        if (!tokenData || !tokenData.data) {
          html += "No data found.<br/></div>";
          continue;
        }

        const token = tokenData.data;
        const score = birdeyeSafetyScore(token);
        if (score < 50) badTokenCount++;

        html += `
          Symbol: ${token.symbol || "?"} | Score: ${score}/100<br/>
          Liquidity: $${parseFloat(token.liquidity_usd || 0).toLocaleString()}<br/>
          Volume: $${parseFloat(token.volume_24h || 0).toLocaleString()}<br/>
          ${score < 60 ? `<span style="color: red;">Low score - risky token</span>` : "<span style='color: green;'>No major red flags</span>"}
        </div>
        `;
      } catch (err) {
        html += "Error scanning token.<br/></div>";
      }
    }

    const health =
      badTokenCount === 0
        ? "Excellent — no risky tokens found."
        : badTokenCount < 3
        ? `Caution: ${badTokenCount} questionable token(s).`
        : `Alert: ${badTokenCount} high-risk tokens.`;

    walletResult.innerHTML = `
      <div style="background:#e3f2fd;padding:1rem;border-left:6px solid #2196f3;">
        <strong>Wallet Health:</strong> ${health}
      </div>` + html;

  } catch (err) {
    console.error("Wallet scan failed:", err);
    walletResult.innerHTML = "<p>Wallet scan failed. Please try again later.</p>";
  }
}
