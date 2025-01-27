// CODE.gs (Google Apps Script)
const SPREADSHEET_ID = "YOUR_SHEET_ID";

function fetchCryptoData() {
  const sources = [
    {name: "CoinGecko", url: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=25&order=market_cap_desc"},
    {name: "CoinMarketCap", url: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=25", headers: {"X-CMC_PRO_API_KEY": "YOUR_FREE_KEY"}},
    {name: "CryptoCompare", url: "https://min-api.cryptocompare.com/data/top/mktcapfull?limit=25&tsym=USD"},
    {name: "Binance", url: "https://api.binance.com/api/v3/ticker/24hr"}
  ];

  let consensusData = [];
  sources.forEach(source => {
    try {
      const response = UrlFetchApp.fetch(source.url, {headers: source.headers || {}});
      const data = JSON.parse(response.getContentText());
      consensusData = mergeData(consensusData, normalizeData(data, source.name));
    } catch(e) {
      console.warn(`Failed ${source.name}: ${e}`);
    }
  });

  if(consensusData.length > 0) {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Consensus");
    const timestamp = new Date();
    consensusData.slice(0,25).forEach((crypto, index) => {
      sheet.appendRow([timestamp, crypto.symbol, crypto.price, crypto.marketCap]);
    });
  }
}

function normalizeData(data, source) {
  // Unified data normalization for all sources
  switch(source) {
    case "CoinGecko": 
      return data.map(c => ({symbol: c.symbol.toUpperCase(), price: c.current_price, marketCap: c.market_cap}));
    case "CoinMarketCap":
      return data.data.map(c => ({symbol: c.symbol, price: c.quote.USD.price, marketCap: c.quote.USD.market_cap}));
    case "CryptoCompare":
      return data.Data.map(c => ({symbol: c.CoinInfo.Name, price: c.RAW.USD.PRICE, marketCap: c.RAW.USD.MKTCAP}));
    case "Binance":
      return data.filter(c => c.symbol.endsWith("USDT")).map(c => ({
        symbol: c.symbol.replace("USDT",""),
        price: parseFloat(c.lastPrice),
        marketCap: parseFloat(c.quoteVolume)
      }));
  }
}

function mergeData(existing, newData) {
  // Smart merging with market cap weighting
  return [...existing, ...newData].reduce((acc, curr) => {
    const existing = acc.find(c => c.symbol === curr.symbol);
    if(existing) {
      existing.price = (existing.price * existing.marketCap + curr.price * curr.marketCap) / 
                      (existing.marketCap + curr.marketCap);
      existing.marketCap += curr.marketCap;
    } else {
      acc.push(curr);
    }
    return acc;
  }, []).sort((a,b) => b.marketCap - a.marketCap);
}

function makePredictions() {
  const history = SpreadsheetApp.openById(SPREADSHEET_ID)
                 .getSheetByName("Consensus")
                 .getDataRange()
                 .getValues()
                 .slice(-72); // Last 3 days data
  
  const model = new LinearRegressionModel();
  model.train(history);
  
  const prediction = model.predict();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Predictions");
  sheet.appendRow([new Date(), ...prediction]);
}

class LinearRegressionModel {
  train(data) {
    // Implement time-series linear regression
    this.coefficients = data[0].slice(2).map((_, col) => {
      const x = data.map((row, idx) => idx);
      const y = data.map(row => row[col + 2]);
      const slope = covariance(x, y) / variance(x);
      return slope;
    });
  }

  predict() {
    return this.coefficients.map(slope => {
      const base = SpreadsheetApp.openById(SPREADSHEET_ID)
                    .getSheetByName("Consensus")
                    .getRange("C2:C26")
                    .getValues()
                    .flat();
      return base.map((price, idx) => price * (1 + slope));
    });
  }
}

function covariance(x, y) {
  const n = x.length;
  const meanX = x.reduce((a,b) => a + b) / n;
  const meanY = y.reduce((a,b) => a + b) / n;
  return x.reduce((acc, _, i) => acc + (x[i] - meanX) * (y[i] - meanY), 0);
}

function variance(arr) {
  const mean = arr.reduce((a,b) => a + b) / arr.length;
  return arr.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0);
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('UI')
    .setTitle('Cryptdictor')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
