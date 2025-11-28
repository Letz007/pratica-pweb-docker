import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erro: Variáveis de ambiente do Supabase não configuradas corretamente');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '*** (definido)' : 'não definido');
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '*** (definido)' : 'não definido');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

const checkBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.storage.getBucket(bucketName);
    if (error) {
            if (error.message.includes('not found') || error.message.includes('not exist')) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error) {
    console.error(`Erro ao verificar o bucket ${bucketName}:`, error);
    return false;
  }
};

const updateBucketPolicy = async (bucketName: string) => {
  try {
    const { data, error } = await supabase.rpc('update_bucket_policy', {
      bucket_name: bucketName,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      }
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao atualizar política do bucket:', error);
    return { data: null, error };
  }
};

const createBucket = async (bucketName: string) => {
  try {
    if (!supabaseAdmin) {
      throw new Error('Chave de serviço (Service Role Key) não configurada. Não é possível criar buckets.');
    }

    console.log(`Tentando criar o bucket: ${bucketName}`);
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/*'],
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });

    if (error) throw error;

        await updateBucketPolicy(bucketName);
    
    console.log('Bucket criado com sucesso:', data);
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao criar o bucket:', error);
    return { data: null, error };
  }
};

const ensureBucketExists = async (bucketName: string) => {
  try {
    const bucketExists = await checkBucketExists(bucketName);
    
    if (!bucketExists) {
      console.log(`Bucket "${bucketName}" não encontrado. Tentando criar...`);
      
            if (supabaseAdmin) {
        return await createBucket(bucketName);
      } else {
        console.warn('Aviso: Chave de serviço (Service Role Key) não configurada. O bucket será criado na primeira interação do usuário autenticado.');
        return { 
          data: null, 
          error: new Error('Service Role Key não configurada. O bucket será criado na primeira interação.') 
        };
      }
    }
    
    console.log(`Bucket "${bucketName}" já existe.`);
    return { data: { name: bucketName }, error: null };
  } catch (error) {
    console.error(`Erro ao verificar/criar o bucket ${bucketName}:`, error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Erro ao verificar/criar bucket') 
    };
  }
};

const initializeBucket = async () => {
  try {
    const { data, error } = await ensureBucketExists('profile-pictures');
    
        if (error && !error.message.includes('Service Role Key')) {
      console.error('Falha ao inicializar o bucket:', error);
      return { success: false, error };
    }
    
    if (data) {
      console.log('Bucket verificado/criado com sucesso!');
    } else {
      console.log('A inicialização do bucket será adiada para a primeira interação do usuário.');
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Erro na inicialização do bucket:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error('Erro desconhecido') 
    };
  }
};

initializeBucket().then(({ success }) => {
  if (success) {
    console.log('Módulo de armazenamento inicializado com sucesso!');
  }
});

export const uploadProfileImage = async (filePath: string, file: File) => {
  const bucketName = 'profile-pictures';
  
  try {
    // Verifica se o bucket existe, se não existir, tenta criar
    const { error: bucketError } = await ensureBucketExists(bucketName);
    
    if (bucketError) {
      console.error('Erro ao verificar/criar o bucket:', bucketError);
      return { data: null, error: bucketError };
    }

    // Faz o upload do arquivo com permissões públicas
    console.log(`Fazendo upload do arquivo para: ${bucketName}/${filePath}`);
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Erro no upload do arquivo:', uploadError);
      return { data: null, error: uploadError };
    }

    // Obtém a URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    console.log('Upload concluído com sucesso! URL:', publicUrl);
    return { 
      data: { 
        path: data.path,
        publicUrl: `${publicUrl}?t=${Date.now()}` // Adiciona timestamp para evitar cache
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Erro no upload da imagem:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Erro desconhecido') 
    };
  }
};

export const listFilesInBucket = async (bucketName: string, path = '') => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Erro ao listar arquivos') 
    };
  }
};

export const removeFile = async (bucketName: string, filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao remover arquivo:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Erro ao remover arquivo') 
    };
  }
};

export const getPublicUrl = (bucketName: string, filePath: string) => {
  try {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return { 
      data: { publicUrl: data.publicUrl }, 
      error: null 
    };
  } catch (error) {
    console.error('Erro ao obter URL pública:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Erro ao obter URL pública') 
    };
  }
};
