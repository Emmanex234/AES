// supabase/functions/send-message-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@2.0.0'

// Your actual API key and email
const RESEND_API_KEY = 're_VFbVnRsq_4P2XYnUtZ1XumoseXETrbv91'
const MANAGEMENT_EMAIL = 'emmanueludofot40@gmail.com'
const COMPANY_EMAIL = 'emmanueludofot40@gmail.com' // Using same email for testing

const resend = new Resend(RESEND_API_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse and validate request body
    const body = await req.json()
    console.log('Received request body:', body)
    
    const { message, recipientType, senderName, senderEmail } = body

    // Validate required fields
    if (!message || !recipientType || !senderName) {
      console.error('Missing required fields:', { message: !!message, recipientType: !!recipientType, senderName: !!senderName })
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['message', 'recipientType', 'senderName'],
        received: { message: !!message, recipientType: !!recipientType, senderName: !!senderName }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Determine recipient email based on type
    let toEmail = ''
    let subject = ''
    
    if (recipientType === 'management') {
      toEmail = MANAGEMENT_EMAIL
      subject = `📨 New Management Message from ${senderName}`
    } else if (recipientType === 'company') {
      toEmail = COMPANY_EMAIL
      subject = `📨 New Company Message from ${senderName}`
    } else {
      console.error('Invalid recipient type:', recipientType)
      return new Response(JSON.stringify({ 
        error: 'Invalid recipient type',
        validTypes: ['management', 'company'],
        received: recipientType
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log(`Preparing to send email to: ${toEmail}, Subject: ${subject}`)

    // Send email using Resend
    const emailData = {
      from: 'onboarding@resend.dev', // Using Resend's test domain
      to: [toEmail], // Resend expects an array
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">📬 New Message Notification</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>👤 From:</strong> ${senderName}${senderEmail ? ` (${senderEmail})` : ''}</p>
            <p><strong>📋 Recipient:</strong> ${recipientType.charAt(0).toUpperCase() + recipientType.slice(1)}</p>
            <p><strong>💬 Message:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #4f46e5; margin: 10px 0;">
              ${message.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This message was sent from your ExpiryAlert management chat system.
          </p>
        </div>
      `,
    }

    console.log('Sending email with data:', emailData)

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Resend API Error:', error)
      return new Response(JSON.stringify({ 
        error: 'Failed to send email', 
        details: error.message || error,
        resendError: error
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('Email sent successfully:', data)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: data?.id,
      recipient: toEmail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})