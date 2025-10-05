import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase'; // We still need this for the function call
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import LoadingOverlay from '../components/LoadingOverlay';

// Import your Supabase URL and Anon Key directly from the environment
// We need these for the manual fetch call
import { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } from '@env';

export default function UploadScreen({ route, navigation }) {
  const { template } = route.params;
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const pickImage = async (index) => {
    // This function is correct, no changes needed
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions!');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages(prevImages => ({ ...prevImages, [index]: result.assets[0].uri }));
    }
  };

  // --- THIS IS THE COMPLETELY REWRITTEN UPLOAD FUNCTION ---
  const handleGenerate = async () => {
    if (!allImagesSelected) return;

    try {
      setLoading(true);
      setLoadingText('Uploading photo...');

      const uploadedImageUrls = [];
      const imageUri = images[0]; // Assuming 1 photo for simplicity
      
      const fileExt = imageUri.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const contentType = `image/${fileExt}`;

      // Construct the manual upload URL for Supabase Storage
      const uploadUrl = `${EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/images/${fileName}`;

      // Create the FormData payload
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: fileName,
        type: contentType,
      });

      // Make the manual fetch request to upload the file
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': EXPO_PUBLIC_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}`, // For anon access
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        // Log the detailed error from the server
        const errorBody = await uploadResponse.text();
        console.error("Manual Upload Failed Body:", errorBody);
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }
      
      console.log("Manual upload successful!");

      // If upload is successful, get the public URL
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
      uploadedImageUrls.push(publicUrl);

      // --- The rest of the function remains the same ---
      setLoadingText('AI is working its magic...');

      const { data: result, error: functionError } = await supabase.functions.invoke('generate-image', {
        body: {
          templateId: template.id,
          imageUrls: uploadedImageUrls,
        },
      });

      if (functionError) throw new Error(functionError.message);
      if (result.error) throw new Error(result.error);
      if (!result.image) throw new Error('AI did not return an image.');

      setLoading(false);
      navigation.navigate('Result', { base64Image: result.image });

    } catch (error) {
      setLoading(false);
      console.error("The entire generation process failed:", error.message);
      Alert.alert('Error', error.message || 'An unknown error occurred.');
    }
  };

  const allImagesSelected = Object.keys(images).length === template.required_photos;

  // The rest of the component (JSX and styles) remains exactly the same
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {loading && <LoadingOverlay text={loadingText} />}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>{template.name}</Text>
        <Text style={styles.description}>{template.description}</Text>
        {Array.from({ length: template.required_photos }).map((_, index) => (
          <TouchableOpacity key={index} style={styles.uploadBox} onPress={() => pickImage(index)}>
            {images[index] ? <Image source={{ uri: images[index] }} style={styles.previewImage} /> : <Text style={styles.uploadText}>+ Upload Photo</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.generateButton, !allImagesSelected && styles.disabledButton]} onPress={handleGenerate} disabled={!allImagesSelected}>
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
