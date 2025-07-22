const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const urls = require('./urls.json');
require('dotenv').config();

async function summarize(text) {
  const res = await axios.post('https://api.gemini.com/v1/summarize', {
    text
  }, {
    headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` }
  });
  return res.data.summary || text.slice(0,100);
}

async function sendWhatsApp(text, pdfUrl=null) {
  const body = pdfUrl 
    ? { messaging_product:"whatsapp", to: process.env.TO_NUMBER, type:"document", document:{link:pdfUrl,filename:pdfUrl.split('/').pop()+'.pdf'}, caption: text }
    : { messaging_product:"whatsapp", to: process.env.TO_NUMBER, type:"text", text:{body:text} };

  await axios.post(`https://graph.facebook.com/v18.0/${process.env.PHONE_ID}/messages`, body, {
    headers:{"Authorization":`Bearer ${process.env.API_KEY}`, "Content-Type":"application/json"}
  });
}

async function checkWebsites() {
  for (let s of urls) {
    try {
      const { data } = await axios.get(s.url);
      const $ = cheerio.load(data);
      const pdfs = $("a[href$='.pdf']").map((i,el)=>$(el).attr('href')).get();
      const cacheFile = `cache/${Buffer.from(s.url).toString('base64')}.json`;
      const old = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile)) : [];
      const newPdfs = pdfs.filter(a=>!old.includes(a));
      if(newPdfs.length){
        for(let link of newPdfs){
          const title = await summarize(`New PDF in ${s.name}: ${link}`);
          await sendWhatsApp(title, link);
        }
        fs.writeFileSync(cacheFile, JSON.stringify(pdfs));
      }
    }catch(e){console.error(s.name, e.message)}
  }
}

module.exports = { checkWebsites };