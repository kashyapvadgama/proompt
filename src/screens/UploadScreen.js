import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import LoadingOverlay from '../components/LoadingOverlay';

export default function UploadScreen({ route, navigation }) {
  const { template } = route.params;
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const pickImage = async (index) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(prevImages => ({
        ...prevImages,
        [index]: result.assets[0].uri,
      }));
    }
  };

  const handleGenerate = async () => {
    if (!allImagesSelected) return;

    try {
      setLoading(true);
      setLoadingText('Uploading photo...');

      const uploadedImageUrls = [];
      
      // Since all our current templates use 1 photo, we'll just upload the first one.
      // This loop is ready for future multi-photo templates.
      for (let i = 0; i < template.required_photos; i++) {
        const imageUri = images[i];
        const fileExt = imageUri.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const contentType = `image/${fileExt}`;
        
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          name: fileName,
          type: contentType,
        });
        
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, formData);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);
        
        uploadedImageUrls.push(publicUrl);
      }
      
      setLoadingText('AI is working its magic...');

      // Call the single 'generate-image' function and wait for the result
      const { data: result, error: functionError } = await supabase.functions.invoke('generate-image', {
        body: {
          templateId: template.id,
          imageUrls: uploadedImageUrls,
        },
      });

      if (functionError) throw new Error(`Function invoke error: ${functionError.message}`);
      if (result.error) throw new Error(`Function logic error: ${result.error}`);
      if (!result.image) throw new Error('The AI did not return an image. Please try again.');

      setLoading(false);

      // Navigate directly to the ResultScreen with the Base64 image
      navigation.navigate('Result', { base64Image: result.image });

    } catch (error) {
      setLoading(false);
      console.error("The generation process failed:", error);
      Alert.alert('Error', error.message || 'An unknown error occurred.');
    }
  };

  const allImagesSelected = Object.keys(images).length === template.required_photos;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {loading && <LoadingOverlay text={loadingText} />}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>{template.name}</Text>
        <Text style={styles.description}>{template.description}</Text>
        {Array.from({ length: template.required_photos }).map((_, index) => (
          <TouchableOpacity key={index} style={styles.uploadBox} onPress={() => pickImage(index)}>
            {images[index] ? (
              <Image source={{ uri: images[index] }} style={styles.previewImage} />
            ) : (
              <Text style={styles.uploadText}>
                {template.required_photos > 1 ? `+ Upload Photo ${index + 1}` : '+ Upload Photo'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity 
          style={[styles.generateButton, !allImagesSelected && styles.disabledButton]} 
          onPress={handleGenerate}
          disabled={!allImagesSelected}
        >
          <Text style={styles.generateButtonText}>Generate</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  description: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
  uploadBox: { width: '90%', height: 250, borderRadius: 16, borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20, backgroundColor: '#f9f9f9', overflow: 'hidden' },
  uploadText: { fontSize: 18, color: '#aaa' },
  previewImage: { width: '100%', height: '100%' },
  generateButton: { width: '90%', padding: 15, borderRadius: 30, backgroundColor: '#f4511e', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  disabledButton: { backgroundColor: '#ccc' },
  generateButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});