// ========== DATA FETCHING ========== //
async function fetchCryptoData() {
  const APIs = [
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25",
    "https://api.coinpaprika.com/v1/tickers?limit=25"
  ];

  try {
    // Try CoinGecko first
    const response = await fetch(APIs[0]);
    if (!response.ok) throw new Error("CoinGecko failed");
    const data = await response.json();
    updateUI(data);
  } catch (error) {
    // Fallback to CoinPaprika
    try {
      const backupResponse = await fetch(APIs[1]);
      const backupData = await backupResponse.json();
      updateUI(backupData.map(coin => ({
        name: coin.name,
        symbol: coin.symbol,
        current_price: coin.quotes.USD.price,
        market_cap: coin.quotes.USD.market_cap
      })));
    } catch (backupError) {
      console.error("All APIs failed:", backupError);
    }
  }
}

// ========== PREDICTION SYSTEM (SIMPLIFIED) ========== //
let isTraining = false;
async function trainAndPredict() {
  if (isTraining) return;
  isTraining = true;
  
  try {
    // Get historical data (last 24 hours)
    const historicalResponse = await fetch("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1");
    const historicalData = await historicalResponse.json();
    const prices = historicalData.prices.map(p => p[1]);

    // Train simple model
    const model = tf.sequential({
      layers: [tf.layers.dense({ units: 1, inputShape: [24] })]
    });
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    // Train on last 24 data points
    const xs = tf.tensor2d([prices.slice(0, 24)]);
    const ys = tf.tensor2d([prices.slice(1, 25)]); // Predict next value
    await model.fit(xs, ys, { epochs: 20, verbose: 0 });

    // Predict next hour
    const latestPrices = prices.slice(-24);
    const prediction = model.predict(tf.tensor2d([latestPrices]));
    const predictedPrice = prediction.dataSync()[0];

    // Display prediction
    document.getElementById("current-prediction").innerHTML = `
      <h3>Bitcoin (BTC)</h3>
      <p>Predicted in 1h: $${predictedPrice.toFixed(2)}</p>
      <small>Last trained: ${new Date().toLocaleTimeString()}</small>
    `;

    // Save to history
    const actualPrice = parseFloat(document.querySelector('.coin-card:first-child p').innerText.replace('$', ''));
    savePrediction(predictedPrice, actualPrice);
  } catch (error) {
    console.error("Prediction failed:", error);
  } finally {
    isTraining = false;
  }
}

// ========== ACCURACY TRACKING ========== //
function savePrediction(predicted, actual) {
  const history = JSON.parse(localStorage.getItem("btc-predictions") || "[]");
  history.push({
    timestamp: Date.now(),
    predicted,
    actual,
    error: Math.abs(predicted - actual)
  });
  localStorage.setItem("btc-predictions", JSON.stringify(history));
  updateAccuracyHistory();
}

// ========== INITIALIZE ========== //
fetchCryptoData();
setInterval(fetchCryptoData, 300000); // Refresh prices every 5 min
setInterval(trainAndPredict, 3600000); // Predict hourly

// First prediction after 5 seconds
setTimeout(trainAndPredict, 5000);
setInterval(fetchCryptoData, 300000); // Refresh prices every 5 min
setInterval(updatePredictions, 3600000); // Update predictions hourly

// First prediction after initial load
setTimeout(async () => {
  await trainModel();
  updatePredictions();
}, 5000);
