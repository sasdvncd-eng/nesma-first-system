const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  
  const frequencyMap = {
    '1': 'سنوي (زيارة واحدة)',
    '2': 'نصف سنوي (زيارتين)',
    '3': 'كل 4 أشهر (3 زيارات)',
    '4': 'ربع سنوي (4 زيارات)',
    '5': '5 زيارات سنوياً',
    '6': 'كل شهرين (6 زيارات)',
    '12': 'شهري (12 زيارة)'
  };

  const statusMap = {
    'active': 'نشط',
    'suspended': 'موقوف'
  };

  const visitStatusMap = {
    'completed': 'مكتملة',
    'pending': 'معلقة/مجردة'
  };

  const resultMap = {
    'passed': 'سليم / ناجح',
    'has_defects': 'يوجد ملاحظات بسيطة',
    'critical_issues': 'خطير / عيوب حرجة',
    'not_visited': 'لم يتم الزيارة'
  };

  console.log('### 1. جدول العملاء والعقود (Clients & Contracts Table)');
  console.log('| الرقم | اسم المنشأة / العميل | رقم العقد | نوع العقد / التردد | تاريخ البداية | تاريخ الانتهاء | حالة العقد | الهاتف | الموقع (الحي) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  
  (data.clients || []).forEach((c, idx) => {
    const freq = frequencyMap[c.visitFrequency] || `تردد (${c.visitFrequency})`;
    const status = statusMap[c.status] || c.status;
    console.log(`| ${idx + 1} | ${c.name || ''} | ${c.contractNumber || ''} | ${freq} | ${c.contractStartDate || ''} | ${c.contractEndDate || ''} | ${status} | \`${c.phone || ''}\` | ${c.locationText || ''} |`);
  });

  console.log('\n\n### 2. جدول زيارات الصيانة وتقارير الفنيين (Maintenance Visits & Tech Reports Table)');
  console.log('| الرقم | اسم المنشأة | رقم العقد | اسم الفني | تاريخ الزيارة المخطط | تاريخ الإنجاز الفعلي | حالة الزيارة | النتيجة / سلامة الأنظمة | ملاحظات الفني | العيوب الموثقة | الفرع (إن وجد) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');

  (data.visits || []).forEach((v, idx) => {
    const status = visitStatusMap[v.status] || v.status;
    const result = resultMap[v.result] || v.result || '---';
    console.log(`| ${idx + 1} | ${v.clientName || ''} | ${v.contractNumber || ''} | ${v.technicianName || ''} | ${v.scheduledDate || ''} | ${v.completedDate || '---'} | ${status} | ${result} | ${v.notes || 'لا يوجد'} | ${v.defects || 'لا يوجد'} | ${v.branchName || 'الرئيسي'} |`);
  });

} catch (err) {
  console.error('Error reading database.json:', err);
}
