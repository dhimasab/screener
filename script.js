const startBtn = document.getElementById('startBtn');
const loadingText = document.getElementById('loading');
const resultsBody = document.getElementById('results-body');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

startBtn.onclick = async () => {
  resultsBody.innerHTML = '';
  loadingText.textContent = 'Mengambil token top 150...';

  const timeframe = document.getElementById('timeframe').value;
  const maLength = parseInt(document.getElementById('maLength').value);
  const filterDirection = document.querySelector('input[name="filterDirection"]:checked').value;

  const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1');
  const coins = await res.json();

  const allResults = [];
  let completed = 0;

  for (let batch = 0; batch < 3; batch++) {
    const batchCoins = coins.slice(batch * 50, (batch + 1) * 50);
    loadingText.textContent = `🚀 Memproses batch ${batch + 1} dari 3...`;

    const batchResults = await Promise.allSettled(batchCoins.map(async (coin) => {
      try {
        const historyRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=${timeframe === 'weekly' ? 700 : 200}`);
        const historyData = await historyRes.json();
        let prices = historyData.prices.map(p => p[1]);

        if (timeframe === 'weekly') {
          const sampled = [];
          for (let i = prices.length - 1; i >= 0; i -= 7) {
            sampled.unshift(prices[i]);
            if (sampled.length === maLength) break;
          }
          prices = sampled;
        } else {
          prices = prices.slice(-maLength);
        }

        const ma = prices.reduce((a, b) => a + b, 0) / prices.length;
        const isAbove = coin.current_price > ma;
        completed++;
        loadingText.textContent = `⏳ Token ke-${completed} dari 150 sedang diproses...`;

        return {
          name: coin.name,
          symbol: coin.symbol,
          current: coin.current_price,
          ma: ma,
          isAbove: isAbove
        };
      } catch (e) {
        completed++;
        loadingText.textContent = `⏳ Token ke-${completed} dari 150 sedang diproses...`;
        return null;
      }
    }));

    allResults.push(...batchResults);

    if (batch < 2) {
      loadingText.textContent = `⏸ Menunggu 65 detik sebelum batch berikutnya...`;
      await sleep(65000);
    }
  }

  const filtered = allResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .filter(token => {
      return filterDirection === 'above' ? token.isAbove : !token.isAbove;
    });

  if (filtered.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="4">⚠️ Tidak ada token yang sesuai filter.</td></tr>`;
  } else {
    filtered.forEach(token => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${token.name} (${token.symbol.toUpperCase()})</td>
        <td>$${token.current.toFixed(2)}</td>
        <td>$${token.ma.toFixed(2)}</td>
        <td class="${token.isAbove ? 'green' : 'red'}">
          ${token.isAbove ? 'Di atas MA ✅' : 'Di bawah MA ❌'}
        </td>
      `;
      resultsBody.appendChild(row);
    });
  }

  loadingText.textContent = `✅ Selesai! ${filtered.length} token sesuai filter.`;
};
