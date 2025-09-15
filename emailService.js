import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const transporter = nodemailer.createTransport({
    SES: {sesClient, SendEmailCommand}
});

class EmailService {
    static async sendWelcomeEmail(userEmail, userName) {
        try {
            const mailOptions = {
                from: 'contact@normaldebate.com',
                to: userEmail,
                subject: 'Welcome to Normal Debate!',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <h2 style="color: #333;">Welcome to Normal Debate, ${userName}!</h2>
                        <p>Thank you for joining our community of thoughtful debate and discussion.</p>
                        
                        <p>Normal Debate is a platform where people with diverse perspectives can come together to discuss important issues in factual, evidence-based ways. We're excited to have you be part of this community.</p>
                        
                        <h3>Getting Started:</h3>
                        <ul>
                            <li>Read our <a href="https://normaldebate.com/welcomeArticle">welcome article</a> to learn more about how Normal Debate works</li>
                            <li>Explore existing discussions and articles</li>
                            <li>Share your first opinion when you're ready</li>
                        </ul>
                        
                        <p>If you have any questions, feel free to reach out to us at contact@normaldebate.com</p>
                        
                        <p>Happy debating!<br>
                        The Normal Debate Team</p>
                    </div>
                `,
                text: `
                    Welcome to Normal Debate, ${userName}!
                    
                    Thank you for joining our community of thoughtful debate and discussion.
                    
                    Normal Debate is a platform where people with diverse perspectives can come together to discuss important issues in factual, evidence-based ways. We're excited to have you be part of this community.
                    
                    Getting Started:
                    - Read our welcome article to learn more about how Normal Debate works
                    - Explore existing discussions and articles  
                    - Share your first opinion when you're ready
                    
                    If you have any questions, feel free to reach out to us at contact@normaldebate.com
                    
                    Happy debating!
                    The Normal Debate Team
                `
            };

            const result = await transporter.sendMail(mailOptions);
            return result;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            throw error;
        }
    }

    static async sendResponseNotification(originalAuthorEmail, originalAuthorName, articleTitle, responseTitle, responderName, articleUrl) {
        try {
            const mailOptions = {
                from: 'contact@normaldebate.com',
                to: originalAuthorEmail,
                subject: `Someone responded to your article: "${articleTitle}"`,
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <h2 style="color: #333;">New Response to Your Article</h2>
                        <p>Hi ${originalAuthorName},</p>
                        
                        <p><strong>${responderName}</strong> has written a response to your article <strong>"${articleTitle}"</strong>.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #0e6ba8;">
                            <h3 style="margin: 0 0 10px 0; color: #333;">Response Title:</h3>
                            <p style="margin: 0; font-size: 16px;">"${responseTitle}"</p>
                        </div>
                        
                        <p>
                            <a href="https://normaldebate.com/article/${articleUrl}" 
                               style="display: inline-block; background-color: #0e6ba8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                                View Response
                            </a>
                        </p>
                        
                        <p>This is a great opportunity to continue the discussion. You can read their response and potentially write a counter-response if you'd like.</p>
                        
                        <p>Thank you for contributing to meaningful debate on Normal Debate!</p>
                        
                        <p>Best regards,<br>
                        The Normal Debate Team</p>
                    </div>
                `,
                text: `
                    New Response to Your Article
                    
                    Hi ${originalAuthorName},
                    
                    ${responderName} has written a response to your article "${articleTitle}".
                    
                    Response Title: "${responseTitle}"
                    
                    View your article and the response at: https://normaldebate.com/article/${articleUrl}
                    
                    This is a great opportunity to continue the discussion. You can read their response and potentially write a counter-response if you'd like.
                    
                    Thank you for contributing to meaningful debate on Normal Debate!
                    
                    Best regards,
                    The Normal Debate Team
                `
            };

            const result = await transporter.sendMail(mailOptions);
            return result;
        } catch (error) {
            console.error('Error sending response notification email:', error);
            throw error;
        }
    }
}

export default EmailService;