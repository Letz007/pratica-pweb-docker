import { User } from '../models/index.js';
import { supabase } from '../config/supabase.js';

export const getProfile = async (req, res) => {
  try {
    const { id } = req.user; // Assumindo que o middleware de autenticação adiciona o usuário ao req
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.user;
    const { name } = req.body;
    
    let updateData = { name };
    
    // Se houver um arquivo de avatar, faz o upload para o Supabase
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const fileBuffer = req.file.buffer;
      
      // Faz upload do arquivo para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(`avatars/${fileName}`, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: true,
          cacheControl: '3600'
        });
      
      if (uploadError) {
        console.error('Erro no upload do Supabase:', uploadError);
        throw new Error('Falha ao fazer upload da imagem');
      }
      
      // Obtém a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(`avatars/${fileName}`);
      
      updateData.avatar_url = publicUrl;
    }
    
    // Atualiza os dados do usuário no banco
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    await user.update(updateData);
    
    // Remove a senha do retorno
    const { password_hash, ...userWithoutPassword } = user.toJSON();
    
    res.json(userWithoutPassword);
    
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao atualizar perfil' 
    });
  }
};
