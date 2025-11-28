import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile, getProfile, uploadProfileImage } from '@/api/auth';
import { Loader2, User, Edit3, Save, X, Upload } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { SupabaseTest } from '@/components/SupabaseTest';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  photo: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFirstEdit, setIsFirstEdit] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, tokens, updateUser } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      photo: user?.photo || '',
    },
  });

  useEffect(() => {
    console.log('Usuário atualizado:', user);
    if (user) {
        let photoUrl = user.photo;
      if (!photoUrl) {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.photo) {
              photoUrl = parsedUser.photo;
              updateUser({ ...user, photo: photoUrl });
            }
          }
        } catch (error) {
          console.error('Erro ao carregar foto do localStorage:', error);
        }
      }
      
      console.log('Atualizando formulário com dados do usuário:', {
        name: user.name,
        email: user.email,
        photo: photoUrl || ''
      });
      
      reset({
        name: user.name,
        email: user.email,
        photo: photoUrl || '',
      });
    }
  }, [user, reset]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      console.error('O arquivo é muito grande. O tamanho máximo permitido é 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      console.log('Iniciando upload do arquivo:', file.name);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      
      const filePath = `user_${user.id}/${fileName}`;

      console.log('Enviando arquivo para o caminho:', filePath);
      
      try {
        await supabase.storage
          .from('profile-pictures')
          .remove([`user_${user.id}/avatar.*`]);
      } catch (error) {
        console.log('Nenhuma imagem anterior para remover ou erro ao remover:', error);
      }
      
      const { data: uploadData, error: uploadError } = await uploadProfileImage(filePath, file);
      
      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        throw uploadError;
      }
      
      console.log('Upload concluído com sucesso:', uploadData);
      
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath, {
          download: false
        });
      
      const timestamp = new Date().getTime();
      const cachedPublicUrl = `${publicUrl}?t=${timestamp}`;
      
      console.log('URL pública da imagem:', cachedPublicUrl);
      
      setValue('photo', cachedPublicUrl, { shouldValidate: true });
      updateUser({ ...user, photo: cachedPublicUrl });
      
      console.log('Foto de perfil atualizada com sucesso!');
      
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const photoUrl = data.photo || user?.photo || '';
      
      const updatedUser = {
        id: user?.id || '',
        name: data.name,
        email: data.email,
        photo: photoUrl
      };
      
      await updateProfile(tokens?.accessToken || '', {
        name: updatedUser.name,
        email: updatedUser.email,
        photo: updatedUser.photo
      });
      
      updateUser(updatedUser);
      
      if (photoUrl) {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...userData, photo: photoUrl }));
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    reset({
      name: user?.name || '',
      email: user?.email || '',
      photo: user?.photo || '',
    });
    setIsEditing(false);
    setIsFirstEdit(true);
  };

  useEffect(() => {
    if (isEditing && isFirstEdit) {
      console.log('Primeira vez editando, ativando input de arquivo...');
      const timer = setTimeout(() => {
        console.log('Tentando acionar o input de arquivo...');
        console.log('fileInputRef.current:', fileInputRef.current);
        if (fileInputRef.current) {
          console.log('Chamando click() no input de arquivo');
          fileInputRef.current.click();
        } else {
          console.error('fileInputRef.current é null ou undefined');
        }
        setIsFirstEdit(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEditing, isFirstEdit]);

  const handleEditClick = (e: React.MouseEvent) => {
    e?.stopPropagation?.();
    console.log('Botão Editar clicado');
    setIsEditing(true);
    
    const timer = setTimeout(() => {
      if (fileInputRef.current) {
        console.log('Disparando clique no input de arquivo');
        fileInputRef.current.click();
      } else {
        console.error('fileInputRef.current é nulo');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Meu Perfil</CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.photo} alt={user?.name} />
                <AvatarFallback className="text-lg">
                  {user?.name ? getInitials(user.name) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{user?.name}</h3>
                <p className="text-gray-600">{user?.email}</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  {...register('name')}
                  disabled={!isEditing}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={!isEditing}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Foto do Perfil</Label>
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={watch('photo')} alt={watch('name') || 'Usuário'} />
                    <AvatarFallback className="text-lg">
                      {watch('name') ? getInitials(watch('name')) : <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  {/* File input - always in the DOM but conditionally styled */}
                  <div className={`space-y-2 ${!isEditing ? 'hidden' : ''}`}>
                    <input
                      id="profile-image-upload"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                    />
                    <Button
                      id="upload-button"
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploading}
                      className="flex items-center space-x-2"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{isUploading ? 'Enviando...' : 'Escolher Imagem'}</span>
                    </Button>
                    <p className="text-xs text-gray-500">Formatos: JPG, PNG, GIF (máx. 5MB)</p>
                  </div>
                  {!isEditing && (
                    <p className="text-sm text-gray-500">
                      Clique em Editar para alterar a foto
                    </p>
                  )}
                </div>
                <input type="hidden" {...register('photo')} />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                {!isEditing ? (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(e);
                    }}
                    className="flex items-center space-x-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Editar</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Salvar</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      className="flex items-center space-x-2"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancelar</span>
                    </Button>
                  </>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
     
    </div>
  );
};

export default Profile;
