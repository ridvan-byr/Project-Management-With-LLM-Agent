const axios = require('axios');

class TogetherAIService {
  constructor() {
    this.togetherApiKey = process.env.TOGETHER_AI_API_KEY;
    this.baseURL = 'https://api.together.xyz/v1';
    this.timeout = 30000;
    
    // Together AI model seçenekleri (sırayla dene) - Sadece çalışan modeller
    this.modelOptions = [
      'mistralai/Mistral-7B-Instruct-v0.2',
      'microsoft/Phi-3-mini-4k-instruct',
      'meta-llama/Llama-3.1-8B-Instruct'
    ];
    this.model = this.modelOptions[0]; // İlk seçeneği kullan
    
    if (!this.togetherApiKey) {
      console.warn('⚠️ TOGETHER_AI_API_KEY bulunamadı! Together AI servisi kullanılamayacak.');
    }
  }

  // Together AI API ile yanıt üret
  async generateResponse(prompt, systemMessage = null, options = {}) {
    if (!this.togetherApiKey) {
      throw new Error('Together AI API key bulunamadı. TOGETHER_AI_API_KEY environment variable\'ını kontrol edin.');
    }
    
    let lastError = null;
    
    // Tüm model seçeneklerini dene
    for (const modelOption of this.modelOptions) {
      try {
        this.model = modelOption;
        console.log(`🤖 Together AI (${this.model}) ile yanıt oluşturuluyor...`);
        
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
            'Authorization': `Bearer ${this.togetherApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });

        const result = response.data.choices[0].message.content.trim();
        console.log(`✅ Together AI yanıtı başarıyla oluşturuldu (${result.length} karakter) - Model: ${this.model}`);
        
        return result;
      } catch (error) {
        lastError = error;
        console.log(`❌ ${this.model} modeli başarısız, diğer model deneniyor...`);
        continue;
      }
    }
    
    // Tüm modeller başarısız oldu
    console.error('❌ Tüm Together AI modelleri başarısız oldu:', lastError.response?.data || lastError.message);
    
    if (lastError.response?.status === 401) {
      throw new Error('Together AI API key geçersiz. Lütfen TOGETHER_AI_API_KEY environment variable\'ını kontrol edin.');
    }
    
    if (lastError.response?.status === 429) {
      throw new Error('Together AI API rate limit aşıldı. Lütfen biraz bekleyin.');
    }
    
    if (lastError.code === 'ECONNABORTED') {
      throw new Error('Together AI API timeout. Lütfen tekrar deneyin.');
    }
    
    throw new Error('Together AI servisi şu anda kullanılamıyor: ' + lastError.message);
  }

  // Model durumunu kontrol et
  async checkStatus() {
    try {
      if (!this.togetherApiKey) {
        return {
          provider: 'Together AI',
          status: 'error',
          error: 'TOGETHER_AI_API_KEY bulunamadı'
        };
      }

      // Basit bir test yanıtı ile API'yi test et
      const testResponse = await this.generateResponse(
        'Merhaba',
        'Sen bir test asistanısın. Sadece "Test başarılı" yanıtını ver.',
        { max_tokens: 10 }
      );

      return {
        provider: 'Together AI',
        status: 'active',
        response: testResponse,
        model: this.model
      };
    } catch (error) {
      return {
        provider: 'Together AI',
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
      name: 'Together AI',
      provider: 'Together AI',
      model: this.model,
      maxTokens: 128000,
      features: ['Chat', 'Code', 'Reasoning', 'Turkish Support', 'Multiple Models'],
      pricing: 'Together AI üzerinden uygun fiyatlı'
    };
  }
}

module.exports = TogetherAIService; 