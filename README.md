# خدمني — منصة خدمات طلابية

نسخة Full-Stack جاهزة للنشر على استضافة Node.js مثل Render.

## التشغيل المحلي
1. Node.js 20+
2. `npm install`
3. ضع `JWT_SECRET` قويًا
4. `npm start`
5. افتح `http://localhost:3000`

## حسابات المطور
يمكن تحديد كلمات مرور حسابات المطور من متغيرات البيئة:
- `ADMIN_PASSWORD`
- `DEV2_PASSWORD`
- `DEV3_PASSWORD`

والحسابات الافتراضية إذا لم تضعها هي:
- admin@khidmeni.local / khidmeni2026
- developer2@khidmeni.local / khidmeni2026-2
- developer3@khidmeni.local / khidmeni2026-3

غيّرها قبل الاستخدام الحقيقي.

## النشر على Render
يوجد ملف `render.yaml` جاهز. أنشئ Web Service من مستودع GitHub، وسيقرأ Render إعدادات البناء والتشغيل.

> ملاحظة: SQLite على خطة الاستضافة المجانية قد تفقد البيانات عند إعادة إنشاء الخدمة/تغيير البنية. للاستخدام الفعلي المستمر يُفضّل قاعدة PostgreSQL أو قرص دائم.

## CliQ
الموقع يحفظ ويعرض رقم/معرّف CliQ لمقدم الخدمة فقط. لا يوجد خصم مالي تلقائي ولا تكامل مصرفي.

## Google
الموقع يحتوي robots.txt وsitemap.xml تلقائيين. بعد النشر اربطه بـ Google Search Console وأرسل `/sitemap.xml` لطلب الفهرسة.
