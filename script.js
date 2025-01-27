// Free APIs with fallbacks
const APIs = [
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&sparkline=false",
  "https://api.coinpaprika.com/v1/tickers?limit=25"
];

// Fetch data with redundancy
async function fetchCryptoData() {
  for (const apiUrl of APIs) {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      updateUI(data);
      return; // Exit if successful
    } catch (error) {
      console.log(`Failed ${apiUrl}, trying next...`);
    }
  }
  alert("All APIs failed. Try refreshing later.");
}

// Display data
function updateUI(data) {
  const container = document.getElementById("crypto-list");
  container.innerHTML = data.map(coin => `
    <div class="coin-card">
      <h3>${coin.name || coin.symbol}</h3>
      <p>$${coin.current_price || coin.price_usd}</p>
      <small>MCap: $${(coin.market_cap || coin.market_cap_usd)?.toLocaleString()}</small>
    </div>
  `).join("");
}

// Simple prediction model (linear regression)
let model;
async function trainModel() {
  // Mock data for example (replace with real historical prices)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const prices = hours.map(h => 30000 + Math.random() * 1000); // Fake BTC prices

  model = tf.sequential({
    layers: [tf.layers.dense({ units: 1, inputShape: [1] })]
  });
  model.compile({ optimizer: "sgd", loss: "meanSquaredError" });

  const xs = tf.tensor2d(hours, [24, 1]);
  const ys = tf.tensor2d(prices, [24, 1]);
  await model.fit(xs, ys, { epochs: 20 });
}

// Predict next hour
async function predict() {
  if (!model) await trainModel();
  const latestPrice = 31000; // Replace with real-time price
  const prediction = model.predict(tf.tensor2d([[24]])); // Predict hour 25
  document.getElementById("prediction").innerHTML = `
    Predicted: $${prediction.dataSync()[0].toFixed(2)}
  `;
  trackAccuracy(latestPrice, prediction.dataSync()[0]);
}

// Track accuracy in localStorage
function trackAccuracy(actual, predicted) {
  const history = JSON.parse(localStorage.getItem("btc-predictions") || "[]");
  history.push({ actual, predicted, timestamp: Date.now() });
  localStorage.setItem("btc-predictions", JSON.stringify(history));

  const errors = history.map(h => Math.abs(h.actual - h.predicted));
  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
  document.getElementById("accuracy").innerHTML = `
    Avg Error: $${avgError.toFixed(2)} over ${history.length} predictions
  `;
}

// Run updates
fetchCryptoData();
setInterval(fetchCryptoData, 300000); // Refresh every 5 minutes
setInterval(predict, 3600000); // Predict hourly
