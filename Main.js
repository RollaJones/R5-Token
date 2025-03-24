window.onload = getTopTokens;

async function checkToken(tokenAddress = null) {
  const inputAddress = document.getElementById("tokenAddress").value;
  const address = tokenAddress || inputAddress;
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Loading...";

  try {
    const proxy = "https://corsproxy.io/?";
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${address}`;
    const response = await fetch(proxy + encodeURIComponent(url));
    const data = await response.json();

    if (!data.pair) {
      resultDiv.innerHTML = "<p>Token not found or invalid.</p>";
      return;
    }

    const token = data.pair;
    const score = calculateSafetyScore(token);
    const redFlags = detectRedFlags(token);

    resultDiv.innerHTML = `
      <h2>${token.baseToken.name || "Unknown Token"}</h2>
      <p><strong>Symbol:</strong> ${token.baseToken.symbol}</p>
      <p><strong>Price:</strong> $${parseFloat(token.priceUsd).toFixed(6)}</p>
      <p><strong>Liquidity:</strong> $${parseFloat(token.liquidity.usd).toLocaleString()}</p>
      <p><strong>Volume 24h:</strong> $${parseFloat(token.volume.h24).toLocaleString()}</p>
      <p><strong>Safety Score:</strong> ${score}/100</p>
    `;

    if (redFlags.length > 0) {
      resultDiv.innerHTML += `
        <div style="background: #ffe4e1; padding: 1rem; margin-top: 1rem;">
          <h3 style="color: #d32f2f;">Red Flags Detected</h3>
          <ul>${redFlags.map(f => `<li>${f}</li>`).join("")}</ul>
        </div>
      `;
    }
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

function detectRedFlags(token) {
  const flags = [];

  if (
    !token.tokenInfo ||
    (token.tokenInfo.tokenProgram !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
  ) {
    flags.push("Token-2022 (may not be supported by all wallets/DEXs)");
  }

  if (!token.baseToken.name || !token.baseToken.symbol) {
    flags.push("Missing name/symbol metadata");
  }

  if (token.liquidity.usd < 1000) {
    flags.push("Very low or no liquidity");
  }

  return flags;
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
          <button onclick="checkToken('${token.pairAddress}')">Scan</button>
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
      html += `<div style="margin: 1rem 0;"><strong>${tokenAddress}</strong><br/>`;

      try {
        const proxy = "https://corsproxy.io/?";
        const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${tokenAddress}`;
        const res = await fetch(proxy + encodeURIComponent(url));
        const tokenData = await res.json();

        if (!tokenData.pair) {
          html += "No DEX data found.<br/></div>";
          continue;
        }

        const token = tokenData.pair;
        const score = calculateSafetyScore(token);
        const redFlags = detectRedFlags(token);
        if (score < 50 || redFlags.length > 0) badTokenCount++;

        html += `
          Symbol: ${token.baseToken.symbol || "?"} | Score: ${score}/100<br/>
          Liquidity: $${parseFloat(token.liquidity.usd).toLocaleString()}<br/>
          ${redFlags.length > 0 ? `<span style="color: red;">Flags: ${redFlags.join(", ")}</span>` : "<span style='color: green;'>No major red flags</span>"}
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
