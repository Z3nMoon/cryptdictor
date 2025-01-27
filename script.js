// ---------- Core Data Fetching ---------- //
async function fetchCryptoData() {
  try {
    // Use CoinGecko API (simplified)
    const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25");
    const data = await response.json();
    updateUI(data);
  } catch (error) {
    console.error("Failed to fetch data:", error);
    alert("API failed. Check console for details.");
  }
}

// ---------- Display Prices ---------- //
function updateUI(data) {
  const container = document.getElementById("crypto-list");
  container.innerHTML = data.map(coin => `
    <div class="coin-card">
      <h3>${coin.name}</h3>
      <p>$${coin.current_price.toFixed(2)}</p>
      <small>MCap: $${coin.market_cap.toLocaleString()}</small>
    </div>
  `).join("");
}

// ---------- Initialize ---------- //
fetchCryptoData();
setInterval(fetchCryptoData, 300000); // Refresh every 5 minutes
