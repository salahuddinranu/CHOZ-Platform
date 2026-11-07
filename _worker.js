export default {
  async fetch(request, env, ctx) {
    try {
      // Static files ko serve karne ki koshish karein
      let response = await env.ASSETS.fetch(request);
      
      // Agar koi page na mile aur user kisi page par jaye, toh index.html dikhayen
      if (response.status === 404 && request.mode === 'navigate') {
        return env.ASSETS.fetch(new Request(new URL('/', request.url)));
      }
      
      return response;
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  }
}
