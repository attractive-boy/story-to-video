import { NextResponse } from 'next/server';
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';

export async function POST(request: Request) {
  try {
    const { base64, fileName, mimeType } = await request.json();

    if (!base64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'images';

    if (!AZURE_STORAGE_CONNECTION_STRING) {
      console.error('AZURE_STORAGE_CONNECTION_STRING is not defined');
      return NextResponse.json({ error: 'Storage configuration missing' }, { status: 500 });
    }

    // Parse connection string to get account name and key for SAS generation
    const parts = AZURE_STORAGE_CONNECTION_STRING.split(';');
    const accountName = parts.find(p => p.startsWith('AccountName='))?.split('=')[1];
    const accountKey = parts.find(p => p.startsWith('AccountKey='))?.split('=')[1];

    if (!accountName || !accountKey) {
      console.error('Could not parse AccountName or AccountKey from connection string');
      return NextResponse.json({ error: 'Invalid storage configuration' }, { status: 500 });
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
    
    // Ensure container exists - removed access: 'blob' to avoid PublicAccessNotPermitted error
    await containerClient.createIfNotExists();

    const blobName = `${Date.now()}-${fileName || 'upload.png'}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Convert base64 to buffer
    const buffer = Buffer.from(base64, 'base64');

    // Upload to Azure
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType || 'image/png' }
    });

    // Generate a SAS token for the blob so it can be accessed even if public access is disabled
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const sasToken = generateBlobSASQueryParameters({
      containerName: AZURE_STORAGE_CONTAINER_NAME,
      blobName: blobName,
      permissions: BlobSASPermissions.parse("r"), // Read only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour expiration
    }, sharedKeyCredential).toString();

    const sasUrl = `${blockBlobClient.url}?${sasToken}`;

    return NextResponse.json({ 
      url: sasUrl,
      success: true 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
