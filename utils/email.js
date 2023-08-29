const SibApiV3Sdk = require('sib-api-v3-sdk')

exports.sendEmail = async (senderName, senderEmail, toName, toEmail, subject, html, attachment) => {
    const defaultClient = SibApiV3Sdk.ApiClient.instance
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_KEY

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi()
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail()

    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = html
    sendSmtpEmail.sender = { name: senderName, email: senderEmail }
    sendSmtpEmail.to = [{ name: toName, email: toEmail }]
    attachment && (sendSmtpEmail.attachment = [{ content: attachment.value, name: attachment.name }])
    
    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail)
        return { status: 200 }
    } catch (e) {
        const code = e?.response?.text ? JSON.parse(e.response.text).code : null
        const reason = { msg: 'Error while sending message', code }
        return { status: 500, reason }
    }
}