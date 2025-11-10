const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadToS3({ key, body, contentType }) {
  const params = { Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType || 'application/octet-stream' };
  await s3.send(new PutObjectCommand(params));
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { uploadToS3 };
