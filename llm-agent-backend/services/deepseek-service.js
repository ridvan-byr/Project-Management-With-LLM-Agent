const axios = require('axios');

class DeepSeekService {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 	"https://api.deepseek.com";
    this.timeout = 30000;
    
    // DeepSeek model seçenekleri (sırayla dene)
    this.modelOptions = [
      "deepseek-chat"
    ];
    this.model = this.modelOptions[0]; // İlk seçeneği kullan
    
    if (!this.deepseekApiKey) {
      console.warn('⚠️ DEEPSEEK_API_KEY bulunamadı! DeepSeek servisi kullanılamayacak.');
    }
  }

  // DeepSeek API ile yanıt üret
  async generateResponse(prompt, systemMessage = null, options = {}) {
    if (!this.deepseekApiKey) {
      throw new Error('DeepSeek API key bulunamadı. DEEPSEEK_API_KEY environment variable\'ını kontrol edin.');
    }
    
    let lastError = null;
    
    // Tüm model seçeneklerini dene
    for (const modelOption of this.modelOptions) {
      try {
        this.model = modelOption;
        console.log(`🤖 DeepSeek (${this.model}) ile yanıt oluşturuluyor...`);
        
        const messages = [];
        
        if (systemMessage) {
          messages.push({
            role: 'system',
            content: systemMessage
          });
        }
        
        messages.push({
          role: 'user',
          content: prompt
        });

        const requestBody = {
          model: this.model,
          messages: messages,
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
          stream: false
        };

        const response = await axios.post(`${this.baseURL}/chat/completions`, requestBody, {
          headers: {
            'Authorization': `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });

        const result = response.data.choices[0].message.content.trim();
        console.log(`✅ DeepSeek yanıtı başarıyla oluşturuldu (${result.length} karakter) - Model: ${this.model}`);
        
        return result;
      } catch (error) {
        lastError = error;
        console.log(`❌ ${this.model} modeli başarısız, diğer model deneniyor...`);
        continue;
      }
    }
    
    // Tüm modeller başarısız oldu
    console.error('❌ Tüm DeepSeek modelleri başarısız oldu:', lastError.response?.data || lastError.message);
    
    if (lastError.response?.status === 401) {
      throw new Error('DeepSeek API key geçersiz. Lütfen DEEPSEEK_API_KEY environment variable\'ını kontrol edin.');
    }
    
    if (lastError.response?.status === 429) {
      throw new Error('DeepSeek API rate limit aşıldı. Lütfen biraz bekleyin.');
    }
    
    if (lastError.code === 'ECONNABORTED') {
      throw new Error('DeepSeek API timeout. Lütfen tekrar deneyin.');
    }
    
    throw new Error('DeepSeek servisi şu anda kullanılamıyor: ' + lastError.message);
  }

  // Model durumunu kontrol et
  async checkStatus() {
    try {
      if (!this.deepseekApiKey) {
        return {
          provider: 'DeepSeek',
          status: 'error',
          error: 'DEEPSEEK_API_KEY bulunamadı'
        };
      }

      // Basit bir test yanıtı ile API'yi test et
      const testResponse = await this.generateResponse(
        'Merhaba',
        'Sen bir test asistanısın. Sadece "Test başarılı" yanıtını ver.',
        { max_tokens: 10 }
      );

      return {
        provider: 'DeepSeek',
        status: 'active',
        response: testResponse,
        model: this.model
      };
    } catch (error) {
      return {
        provider: 'DeepSeek',
        status: 'error',
        error: error.message
      };
    }
  }

  // Genel sohbet için
  async chat(message, context = null) {
    const systemMessage = `Sen bir görev yönetim sistemi asistanısın. 
    Kullanıcılara görev yönetimi konusunda yardım ediyorsun.
    Türkçe yanıt ver. Kısa ve öz ol.`;
    
    let prompt = message;
    if (context) {
      prompt = `Bağlam: ${context}\n\nSoru: ${message}`;
    }
    
    return await this.generateResponse(prompt, systemMessage, {
      max_tokens: 400,
      temperature: 0.5
    });
  }

  // Model bilgilerini getir
  async getModelInfo() {
    return {
      name: 'DeepSeek',
      provider: 'DeepSeek',
      model: this.model,
      maxTokens: 128000,
      features: ['Chat', 'Code', 'Reasoning', 'Turkish Support', 'Advanced Reasoning'],
      pricing: 'DeepSeek üzerinden uygun fiyatlı'
    };
  }
}

module.exports = DeepSeekService; 