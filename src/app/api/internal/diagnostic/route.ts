import { NextRequest, NextResponse } from 'next/server';
import { DiagnosticService } from '@/lib/internal/diagnostic';
import { AIModelService } from '@/lib/internal/ai-models';

const odarkDiagnosticPrompt = `
Kamu adalah ODARK, AI asisten internal di platform chat.zai. Tugasmu sekarang adalah melakukan pengecekan menyeluruh terhadap sistem, modul, dan logika operasional AI. Gunakan komponen internal chat.zai untuk menganalisis, mendeteksi, dan jika diizinkan, memperbaiki masalah yang ditemukan.

🧩 Tujuan:
- Deteksi bug, error, atau kendala logika
- Analisis penyebab dan dampaknya
- Eksekusi perbaikan jika disetujui
- Simpan semua hasil ke log audit internal

🧠 Langkah Diagnostik:
1. **Analisis Input & Respons Terakhir**  
   - Cek apakah ada ketidaksesuaian antara input dan output  
   - Identifikasi respons yang tidak relevan, ambigu, atau gagal eksekusi

2. **Cek Modul Eksekusi**  
   - Validasi \`agentExecutor.ts\`, \`promptBuilder.ts\`, dan adapter lainnya  
   - Pastikan semua modul aktif dan tidak ada error sintaks/logika

3. **Audit Database & Penyimpanan Lokal**  
   - Cek apakah data tersimpan dengan benar  
   - Validasi struktur, integritas, dan aksesibilitas data

4. **Validasi API Sistem Internal**  
   - Pastikan semua perintah seperti \`restartAgent\`, \`queryDB\`, \`sendNotification\` berjalan normal  
   - Laporkan jika ada endpoint yang gagal atau tidak responsif

5. **Perbaikan Otomatis (Jika Diizinkan)**  
   - Jika ditemukan masalah dan perbaikan bisa dilakukan secara internal, jalankan patch  
   - Simpan hasil perbaikan ke log audit

⚠️ Semua perbaikan harus bisa diaudit dan dibatalkan.  
⚠️ Jangan ubah data sensitif tanpa persetujuan eksplisit.  
⚠️ Laporkan semua temuan dengan ringkas dan jelas.

Contoh gaya bicara ODARK saat diagnostik:
- "Saya mendeteksi ketidaksesuaian antara input dan output. Modul promptBuilder perlu diperiksa."  
- "Database internal menunjukkan anomali pada struktur preferensi pengguna. Perlu saya perbaiki?"  
- "Perintah restartAgent gagal dijalankan. Endpoint internal tidak responsif."

Kamu adalah ODARK diagnostik. Kamu bertugas menjaga stabilitas, integritas, dan keandalan sistem AI internal chat.zai.
`;

export async function POST(request: NextRequest) {
  try {
    const { action, fixAction, sessionId } = await request.json();
    const diagnosticService = DiagnosticService.getInstance();

    switch (action) {
      case 'run_diagnostic':
        const diagnostic = await diagnosticService.runFullDiagnostic(sessionId);
        
        return NextResponse.json({
          success: true,
          diagnostic,
          timestamp: new Date().toISOString()
        });

      case 'auto_fix':
        if (!fixAction) {
          return NextResponse.json(
            { error: 'Fix action is required' },
            { status: 400 }
          );
        }

        const fixSuccess = await diagnosticService.executeAutoFix(fixAction, sessionId);
        
        return NextResponse.json({
          success: fixSuccess,
          message: fixSuccess 
            ? `Auto-fix "${fixAction}" executed successfully` 
            : `Auto-fix "${fixAction}" failed`,
          timestamp: new Date().toISOString()
        });

      case 'ai_diagnostic':
        // Use AI to analyze and provide recommendations
        const { diagnostic } = await request.json();
        
        if (!diagnostic) {
          return NextResponse.json(
            { error: 'Diagnostic data is required for AI analysis' },
            { status: 400 }
          );
        }

        const aiModelService = AIModelService.getInstance();
        
        const analysisPrompt = `
${odarkDiagnosticPrompt}

Berikut adalah hasil diagnostik sistem terbaru:
${JSON.stringify(diagnostic, null, 2)}

Berdasarkan hasil diagnostik ini, berikan analisis mendalam dan rekomendasi tindakan yang harus saya ambil. Fokus pada:
1. Prioritas masalah yang perlu segera ditangani
2. Root cause analysis
3. Rekomendasi perbaikan spesifik
4. Langkah preventif untuk masa depan

Jawab dalam gaya ODARK yang profesional dan operasional.
`;

        const messages = [
          {
            role: 'system' as const,
            content: odarkDiagnosticPrompt
          },
          {
            role: 'user' as const,
            content: analysisPrompt
          }
        ];

        const aiAnalysis = await aiModelService.chatCompletion(messages, sessionId);

        return NextResponse.json({
          success: true,
          aiAnalysis: aiAnalysis.response,
          model: aiAnalysis.model,
          usage: aiAnalysis.usage,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Diagnostic API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const diagnosticService = DiagnosticService.getInstance();

    switch (action) {
      case 'quick_check':
        // Quick health check
        const quickDiagnostic = await diagnosticService.runFullDiagnostic();
        
        return NextResponse.json({
          success: true,
          status: quickDiagnostic.overall,
          summary: quickDiagnostic.summary,
          timestamp: new Date().toISOString()
        });

      case 'history':
        // Get diagnostic history from audit logs
        const history = await diagnosticService.getDiagnosticHistory();
        
        return NextResponse.json({
          success: true,
          history,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Diagnostic GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}