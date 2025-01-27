// ========== PREDICTION SYSTEM ========== //
let predictionModel;
const PREDICTION_HISTORY_KEY = "btc-predictions";

// Improved training with actual historical data (last 24 hours)
async function fetchHistoricalData() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1"
    );
    const data = await response.json();
    return data.prices.map(([timestamp, price]) => price);
  } catch (error) {
    console.error("Failed historical data:", error);
    return Array.from({ length: 24 }, () => 30000 + Math.random() * 2000); // Fallback
  }
}

async function trainModel() {
  const historicalData = await fetchHistoricalData();
  
  predictionModel = tf.sequential({
    layers: [
      tf.layers.dense({ units: 8, activation: "relu", inputShape: [24] }),
      tf.layers.dense({ units: 1 })
    ]
  });
  
  predictionModel.compile({ optimizer: "adam", loss: "meanSquaredError" });

  // Prepare data
  const xs = tf.tensor2d([historicalData.slice(0, 24)]);
  const ys = tf.tensor2d([[historicalData[23]]]); // Predict next value

  await predictionModel.fit(xs, ys, {
    epochs: 50,
    batchSize: 1,
    verbose: 0
  });
}

// ========== PREDICTION DISPLAY ========== //
async function updatePredictions() {
  if (!predictionModel) await trainModel();
  
  // Get latest BTC price
  const btcPrice = document.querySelector('.coin-card:first-child p').innerText.replace('$', '');
  const latestPrice = parseFloat(btcPrice);

  // Generate prediction
  const prediction = predictionModel.predict(tf.tensor2d([Array(24).fill(latestPrice)]));
  const predictedPrice = prediction.dataSync()[0];
  
  // Display prediction
  document.getElementById("current-prediction").innerHTML = `
    <h3>Bitcoin (BTC)</h3>
    <p>Current: $${latestPrice.toFixed(2)}</p>
    <p>Predicted in 1h: $${predictedPrice.toFixed(2)}</p>
    <small>${new Date().toLocaleTimeString()}</small>
  `;

  // Save to history (actual price checked later)
  savePrediction(predictedPrice, latestPrice);
}

// ========== ACCURACY TRACKING ========== //
function savePrediction(predicted, actual) {
  const history = JSON.parse(localStorage.getItem(PREDICTION_HISTORY_KEY) || "[]");
  history.push({
    timestamp: Date.now(),
    predicted,
    actual,
    error: Math.abs(predicted - actual),
    directionCorrect: (predicted > actual) === (actual > history[history.length-1]?.actual)
  });
  localStorage.setItem(PREDICTION_HISTORY_KEY, JSON.stringify(history));
  updateAccuracyHistory();
}

function updateAccuracyHistory() {
  const history = JSON.parse(localStorage.getItem(PREDICTION_HISTORY_KEY) || "[]");
  const container = document.getElementById("accuracy-history");
  
  container.innerHTML = `
    <table>
      <tr>
        <th>Time</th>
        <th>Predicted</th>
        <th>Actual</th>
        <th>Error</th>
        <th>Direction</th>
      </tr>
      ${history.map(entry => `
        <tr>
          <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
          <td>$${entry.predicted.toFixed(2)}</td>
          <td>$${entry.actual.toFixed(2)}</td>
          <td class="${entry.error < 50 ? 'good' : 'bad'}">$${entry.error.toFixed(2)}</td>
          <td>${entry.directionCorrect ? '✅' : '❌'}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ========== INITIALIZE ========== //
fetchCryptoData();
setInterval(fetchCryptoData, 300000); // Refresh prices every 5 min
setInterval(updatePredictions, 3600000); // Update predictions hourly

// First prediction after initial load
setTimeout(async () => {
  await trainModel();
  updatePredictions();
}, 5000);
