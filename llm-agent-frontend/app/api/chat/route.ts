// Bunun yerine backend'e proxy yapıyorum
export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();
  // Son kullanıcı mesajını al
  const lastMessage = messages[messages.length - 1];
  // Kullanıcıdan token al (istek header'ından veya cookie'den alınabilir, burada örnek olarak boş bırakıldı)
  // İsterseniz header'dan token forward edebilirsiniz
  const response = await fetch('http://localhost:3001/api/chatbot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': 'Bearer ' + token, // Eğer gerekiyorsa ekleyin
    },
    body: JSON.stringify({
      message: lastMessage.content
    })
  });
  const data = await response.json();
  return new Response(JSON.stringify({
    choices: [{ message: { content: data.response } }]
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
} 