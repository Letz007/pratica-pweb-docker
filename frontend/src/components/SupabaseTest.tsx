import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';

type TestResult = {
  success: boolean;
  message: string;
  details?: any;
};

export const SupabaseTest = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const addTestResult = (success: boolean, message: string, details?: any) => {
    setTestResults(prev => [...prev, { success, message, details }]);
    return success;
  };

  const testSupabaseConnection = async () => {
    setIsTesting(true);
    setError(null);
    setTestResults([]);
    
    try {
      // Test 1: Verificar se as variáveis de ambiente estão configuradas
      const envVars = {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      };

      console.log('Variáveis de ambiente:', envVars);
      
      if (!envVars.VITE_SUPABASE_URL || !envVars.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Variáveis de ambiente do Supabase não configuradas corretamente');
      }
      
      addTestResult(true, 'Variáveis de ambiente configuradas corretamente');
      
      // Test 2: Verificar conexão com o Supabase
      console.log('Testando conexão com o Supabase...');
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Erro na autenticação:', authError);
        throw authError;
      }
      
      addTestResult(true, 'Conexão com o Supabase estabelecida com sucesso');
      
      // Test 3: Tentar listar os buckets
      console.log('Listando buckets...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Erro ao listar buckets:', bucketsError);
        throw bucketsError;
      }
      
      console.log('Buckets encontrados:', buckets);
      addTestResult(true, 'Buckets listados com sucesso', { 
        count: buckets.length,
        buckets: buckets.map(b => b.name)
      });
      
      // Verificar se o bucket profile-pictures existe
      const profilePicturesBucket = buckets.find(b => b.name === 'profile-pictures');
      
      if (!profilePicturesBucket) {
        console.log('Bucket "profile-pictures" não encontrado. Tentando criar...');
        const { error: createError } = await supabase.storage.createBucket('profile-pictures', {
          public: true,
          allowedMimeTypes: ['image/*'],
          fileSizeLimit: 1024 * 1024 * 5, // 5MB
        });
        
        if (createError) {
          console.error('Erro ao criar bucket:', createError);
          throw new Error(`Falha ao criar o bucket: ${createError.message}`);
        }
        
        addTestResult(true, 'Bucket "profile-pictures" criado com sucesso');
      } else {
        addTestResult(true, 'Bucket "profile-pictures" encontrado');
      }
      
      // Test 4: Tentar fazer upload de um arquivo de teste
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const filePath = `test-${Date.now()}.txt`;
      
      console.log('Tentando fazer upload de arquivo de teste...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, testFile);
      
      if (uploadError) {
        console.error('Erro no upload de teste:', uploadError);
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }
      
      addTestResult(true, 'Upload de teste bem-sucedido', { path: uploadData.path });
      
      // Test 5: Tentar baixar o arquivo de teste
      console.log('Tentando baixar o arquivo de teste...');
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from('profile-pictures')
        .download(filePath);
      
      if (downloadError) {
        console.error('Erro ao baixar o arquivo de teste:', downloadError);
        throw new Error(`Falha no download: ${downloadError.message}`);
      }
      
      addTestResult(true, 'Download do arquivo de teste bem-sucedido');
      
      // Test 6: Tentar excluir o arquivo de teste
      console.log('Tentando excluir o arquivo de teste...');
      const { data: deleteData, error: deleteError } = await supabase.storage
        .from('profile-pictures')
        .remove([filePath]);
      
      if (deleteError) {
        console.error('Erro ao excluir o arquivo de teste:', deleteError);
        throw new Error(`Falha ao excluir: ${deleteError.message}`);
      }
      
      addTestResult(true, 'Exclusão do arquivo de teste bem-sucedida');
      
      // Teste finalizado com sucesso
      setIsConnected(true);
      return true;
    } catch (err) {
      console.error('Erro no teste de conexão:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Falha na conexão com o Supabase\n${errorMessage}`);
      setIsConnected(false);
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Teste de Conexão com Supabase</h2>
      
      <div className="mb-6">
        <Button 
          onClick={testSupabaseConnection}
          disabled={isTesting}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${isTesting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isTesting ? 'Testando...' : 'Executar Teste'}
        </Button>
      </div>
      
      {isConnected !== null && (
        <div className={`p-4 mb-6 rounded-md ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isConnected ? 'text-green-800' : 'text-red-800'}`}>
            {isConnected ? '✅ Conexão bem-sucedida!' : '❌ Falha na conexão'}
          </h3>
          <p className="text-sm text-gray-600">
            {isConnected 
              ? 'Sua aplicação está conectada corretamente ao Supabase.'
              : 'Houve um problema ao conectar ao Supabase. Verifique os detalhes abaixo.'}
          </p>
        </div>
      )}
      
      {testResults.length > 0 && (
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Detalhes do Teste</h3>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="flex items-start">
                  <span className={`mr-2 mt-0.5 ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                    {result.success ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                      {result.message}
                    </p>
                    {result.details && (
                      <pre className="mt-1 text-xs text-gray-600 overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Erro</h3>
          <div className="p-3 bg-white rounded border border-red-100">
            <pre className="text-sm text-red-700 whitespace-pre-wrap overflow-auto">{error}</pre>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            <p className="font-medium">Dicas para solução de problemas:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Verifique se as variáveis de ambiente estão corretas</li>
              <li>Confira se o CORS está configurado no painel do Supabase</li>
              <li>Verifique se a chave anônima tem permissões suficientes</li>
              <li>Consulte o console do navegador para mais detalhes (F12 → Console)</li>
            </ul>
          </div>
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Informações de Depuração</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>URL: {import.meta.env.VITE_SUPABASE_URL || 'Não definido'}</p>
          <p>Chave Anônima: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '*** (definida)' : 'Não definida'}</p>
          <p>Ambiente: {import.meta.env.MODE}</p>
        </div>
      </div>
    </div>
  );
};

export default SupabaseTest;
