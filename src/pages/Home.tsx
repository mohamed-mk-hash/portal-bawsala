import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from '../components/Card';
import { useLanguage } from '../i18n/LanguageContext';

interface LocalizedText {
  en: string;
  ar: string;
}

interface ImageField {
  url: string;
  publicId: string;
}

interface HeroLogo {
  name: string;
  image: ImageField;
}

interface HeroSection {
  badgeText: LocalizedText;
  badgeLinkText: LocalizedText;
  titleBeforeHighlight: LocalizedText;
  highlightedTitle: LocalizedText;
  titleAfterHighlight: LocalizedText;
  subtitle: LocalizedText;
  primaryButton: LocalizedText;
  primaryButtonUrl: string;
  secondaryButton: LocalizedText;
  secondaryButtonUrl: string;
  image: ImageField;
  trustTitle: LocalizedText;
  trustStatus: LocalizedText;
  logos: HeroLogo[];
}

interface ServiceItem {
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
  linkText: LocalizedText;
  linkUrl: string;
}

interface ServicesSection {
  kicker: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  items: ServiceItem[];
}

interface ResultStat {
  value: string;
  label: LocalizedText;
}

interface ResultsSection {
  kicker: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  darkCardTitle: LocalizedText;
  darkCardDescription: LocalizedText;
  darkCardButton: LocalizedText;
  darkCardButtonUrl: string;
  analysisImage: ImageField;
  analysisTitle: LocalizedText;
  analysisDescription: LocalizedText;
  analysisLinkText: LocalizedText;
  analysisLinkUrl: string;
  partnerTitle: LocalizedText;
  partnerDescription: LocalizedText;
  partnerImage: ImageField;
  statsTitle: LocalizedText;
  statsSubtitle: LocalizedText;
  stats: ResultStat[];
}

interface ChoiceCard {
  title: LocalizedText;
  description: LocalizedText;
}

interface ChoiceStat {
  value: string;
  label: LocalizedText;
}

interface ChooseSection {
  title: LocalizedText;
  subtitle: LocalizedText;
  image: ImageField;
  cards: ChoiceCard[];
  stats: ChoiceStat[];
}

interface FaqItem {
  question: LocalizedText;
  answer: LocalizedText;
}

interface FaqSection {
  kicker: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  items: FaqItem[];
}

interface HomeContent {
  hero: HeroSection;
  services: ServicesSection;
  results: ResultsSection;
  choose: ChooseSection;
  faq: FaqSection;
}

type Tab = 'hero' | 'services' | 'results' | 'choose' | 'faq';

type ImageKey =
  | 'heroImage'
  | 'resultsAnalysisImage'
  | 'resultsPartnerImage'
  | 'chooseImage';

type ImageFiles = Record<ImageKey, File | null>;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const compressImageToLimit = async (
  file: File,
  {
    maxSizeBytes = 10 * 1024 * 1024,
    maxWidth = 1600,
    maxHeight = 1600,
    minQuality = 0.45,
    initialQuality = 0.82,
    outputType = 'image/jpeg',
  } = {}
): Promise<File> => {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.size <= maxSizeBytes) return file;

  const readFileAsDataURL = (inputFile: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(inputFile);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const dataUrl = await readFileAsDataURL(file);
  const image = await loadImage(dataUrl);

  let targetWidth = image.width;
  let targetHeight = image.height;

  const widthRatio = maxWidth / targetWidth;
  const heightRatio = maxHeight / targetHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  targetWidth = Math.round(targetWidth * ratio);
  targetHeight = Math.round(targetHeight * ratio);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return file;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const toBlob = (quality: number, type: string) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });

  let quality = initialQuality;
  let blob = await toBlob(quality, outputType);

  if (!blob) return file;

  while (blob.size > maxSizeBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.08);
    blob = await toBlob(quality, outputType);
    if (!blob) return file;
  }

  let scale = 0.9;

  while (blob.size > maxSizeBytes && canvas.width > 800 && canvas.height > 800) {
    const resizedCanvas = document.createElement('canvas');
    const resizedCtx = resizedCanvas.getContext('2d');

    if (!resizedCtx) return file;

    resizedCanvas.width = Math.round(canvas.width * scale);
    resizedCanvas.height = Math.round(canvas.height * scale);

    resizedCtx.drawImage(
      canvas,
      0,
      0,
      resizedCanvas.width,
      resizedCanvas.height
    );

    canvas.width = resizedCanvas.width;
    canvas.height = resizedCanvas.height;
    ctx.drawImage(resizedCanvas, 0, 0);

    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), outputType, quality);
    });

    if (!blob) return file;
    scale = 0.92;
  }

  const originalBaseName = file.name.replace(/\.[^/.]+$/, '');

  return new File([blob], `${originalBaseName}.jpg`, {
    type: outputType,
    lastModified: Date.now(),
  });
};

const uploadImageToCloudinary = async (file: File) => {
  if (!file) return { url: '', publicId: '' };

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables are missing');
  }

  const processedFile = await compressImageToLimit(file, {
    maxSizeBytes: 10 * 1024 * 1024,
    maxWidth: 1600,
    maxHeight: 1600,
    initialQuality: 0.82,
    minQuality: 0.45,
    outputType: 'image/jpeg',
  });

  const body = new FormData();
  body.append('file', processedFile);
  body.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Cloudinary upload failed');
  }

  return {
    url: data.secure_url || '',
    publicId: data.public_id || '',
  };
};

const defaultHomeContent: HomeContent = {
  hero: {
    badgeText: {
      en: 'New?',
      ar: 'جديد؟',
    },
    badgeLinkText: {
      en: 'Explore how we help organizations find clear direction',
      ar: 'اكتشف كيف نساعد المؤسسات على إيجاد اتجاه واضح',
    },
    titleBeforeHighlight: {
      en: 'Clear guidance for better thinking and better outcomes with',
      ar: 'إرشاد واضح لتفكير أفضل ونتائج أفضل مع',
    },
    highlightedTitle: {
      en: 'Bawssala',
      ar: 'بوصلة',
    },
    titleAfterHighlight: {
      en: '',
      ar: '',
    },
    subtitle: {
      en: 'Bawssala works with organizations and leaders to bring clarity, structure, and practical support to the challenges they face.',
      ar: 'تعمل بوصلة مع المؤسسات والقادة لتقديم الوضوح والهيكلة والدعم العملي للتحديات التي يواجهونها.',
    },
    primaryButton: {
      en: 'Request a Consultation',
      ar: 'اطلب استشارة',
    },
    primaryButtonUrl: '/contact',
    secondaryButton: {
      en: 'Discover our services',
      ar: 'اكتشف خدماتنا',
    },
    secondaryButtonUrl: '/services',
    image: {
      url: '',
      publicId: '',
    },
    trustTitle: {
      en: 'Trusted Guidance',
      ar: 'إرشاد موثوق',
    },
    trustStatus: {
      en: 'Available for consultation',
      ar: 'متاح للاستشارة',
    },
    logos: [
  { name: 'GlobalBank', image: { url: '', publicId: '' } },
  { name: 'Spherule', image: { url: '', publicId: '' } },
  { name: 'FeatherDev', image: { url: '', publicId: '' } },
  { name: 'Lightbox', image: { url: '', publicId: '' } },
  { name: 'Nietzsche', image: { url: '', publicId: '' } },
  { name: 'Boltshift', image: { url: '', publicId: '' } },
],
  },

  services: {
    kicker: {
      en: 'Our Services',
      ar: 'خدماتنا',
    },
    title: {
      en: 'All you need to run your business',
      ar: 'كل ما تحتاجه لإدارة عملك',
    },
    subtitle: {
      en: 'Practical, structured solutions designed to help startups, entrepreneurs, and organizations grow, operate efficiently, and scale with confidence.',
      ar: 'حلول عملية ومنظمة مصممة لمساعدة الشركات الناشئة ورواد الأعمال والمؤسسات على النمو والعمل بكفاءة والتوسع بثقة.',
    },
    items: [
      {
        icon: 'chart',
        title: {
          en: 'Management Development',
          ar: 'تطوير الإدارة',
        },
        description: {
          en: 'Strengthening leadership, improving internal processes, and building efficient organizational systems that support sustainable growth.',
          ar: 'تعزيز القيادة وتحسين العمليات الداخلية وبناء أنظمة تنظيمية فعالة تدعم النمو المستدام.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
      {
        icon: 'analytics',
        title: {
          en: 'Business Planning',
          ar: 'تخطيط الأعمال',
        },
        description: {
          en: 'Strategic consulting to help you define direction, validate ideas, and build clear execution roadmaps for sustainable business growth.',
          ar: 'استشارات استراتيجية تساعدك على تحديد الاتجاه واختبار الأفكار وبناء خرائط تنفيذ واضحة لنمو مستدام.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
      {
        icon: 'education',
        title: {
          en: 'Curriculum & Training Programs',
          ar: 'المناهج وبرامج التدريب',
        },
        description: {
          en: 'Designing structured training programs and educational content that build skills, improve performance.',
          ar: 'تصميم برامج تدريبية منظمة ومحتوى تعليمي يبني المهارات ويحسن الأداء.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
      {
        icon: 'users',
        title: {
          en: 'Workshop & Training Programs',
          ar: 'ورش العمل وبرامج التدريب',
        },
        description: {
          en: 'Delivering interactive workshops and hands-on training sessions that transform knowledge into practical skills.',
          ar: 'تقديم ورش عمل تفاعلية وجلسات تدريبية عملية تحول المعرفة إلى مهارات قابلة للتطبيق.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
      {
        icon: 'marketing',
        title: {
          en: 'Digital Marketing',
          ar: 'التسويق الرقمي',
        },
        description: {
          en: 'Building and managing digital campaigns that increase visibility, engagement, and customer acquisition across online platforms.',
          ar: 'بناء وإدارة حملات رقمية تزيد الظهور والتفاعل واكتساب العملاء عبر المنصات الرقمية.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
      {
        icon: 'code',
        title: {
          en: 'Website Design & Development',
          ar: 'تصميم وتطوير المواقع',
        },
        description: {
          en: 'Designing and developing modern, responsive websites that help organizations build a strong and professional digital presence.',
          ar: 'تصميم وتطوير مواقع حديثة ومتجاوبة تساعد المؤسسات على بناء حضور رقمي قوي واحترافي.',
        },
        linkText: {
          en: 'Learn more',
          ar: 'اعرف المزيد',
        },
        linkUrl: '/services',
      },
    ],
  },

  results: {
    kicker: {
      en: 'Why Choose Bawsala',
      ar: 'لماذا تختار بوصلة',
    },
    title: {
      en: 'Experience You Can Measure. Results You Can Trust.',
      ar: 'خبرة يمكنك قياسها. ونتائج يمكنك الوثوق بها.',
    },
    subtitle: {
      en: 'Our work is defined by outcomes, not claims. Every number reflects a real project, a real client, and real impact.',
      ar: 'عملنا يُقاس بالنتائج لا بالوعود. كل رقم يعكس مشروعًا حقيقيًا وعميلًا حقيقيًا وأثرًا ملموسًا.',
    },
    darkCardTitle: {
      en: 'Proven Development Experience',
      ar: 'خبرة تطوير مثبتة',
    },
    darkCardDescription: {
      en: 'We have supported organizations across multiple sectors with practical management, and execution solutions.',
      ar: 'دعمنا مؤسسات من قطاعات متعددة بحلول عملية في الإدارة والتنفيذ.',
    },
    darkCardButton: {
      en: 'Explore our services',
      ar: 'اكتشف خدماتنا',
    },
    darkCardButtonUrl: '/services',
    analysisImage: {
      url: '',
      publicId: '',
    },
    analysisTitle: {
      en: 'Built on Analysis, Designed for Reality',
      ar: 'مبني على التحليل ومصمم للواقع',
    },
    analysisDescription: {
      en: 'We begin with deep analysis of your environment...',
      ar: 'نبدأ بتحليل عميق لبيئتك...',
    },
    analysisLinkText: {
      en: 'Learn About Our Method',
      ar: 'تعرف على منهجيتنا',
    },
    analysisLinkUrl: '/about',
    partnerTitle: {
      en: 'A partner you can rely on anytime',
      ar: 'شريك يمكنك الاعتماد عليه في أي وقت',
    },
    partnerDescription: {
      en: 'Bawssala is not a one-time consultant. We remain available to support, guide, and advise our clients throughout their journey.',
      ar: 'بوصلة ليست مستشارًا لمرة واحدة. نبقى متاحين لدعم عملائنا وتوجيههم ومرافقتهم طوال رحلتهم.',
    },
    partnerImage: {
      url: '',
      publicId: '',
    },
    statsTitle: {
      en: 'Impact & Scale',
      ar: 'الأثر والنطاق',
    },
    statsSubtitle: {
      en: 'Results that speak for themselves',
      ar: 'نتائج تتحدث عن نفسها',
    },
    stats: [
      {
        value: '466+',
        label: {
          en: 'Development projects delivered',
          ar: 'مشروع تطوير تم تسليمه',
        },
      },
      {
        value: '40+',
        label: {
          en: 'Long-term collaborating clients',
          ar: 'عميل شريك طويل الأمد',
        },
      },
      {
        value: '3,680+',
        label: {
          en: 'Marketing Activities Executed',
          ar: 'نشاط تسويقي تم تنفيذه',
        },
      },
    ],
  },

  choose: {
    title: {
      en: 'Why Organizations Choose Bawssala',
      ar: 'لماذا تختار المؤسسات بوصلة',
    },
    subtitle: {
      en: 'With thousands of properties listed and satisfied users across algeria, our platform is reshaping the way people, sell, and rent homes.',
      ar: 'بخبرة واسعة وشركاء راضين عبر الجزائر، نساعد المؤسسات على بناء أنظمة أوضح وتحقيق أثر أفضل.',
    },
    image: {
      url: '',
      publicId: '',
    },
    cards: [
      {
        title: {
          en: 'Proven Experience',
          ar: 'خبرة مثبتة',
        },
        description: {
          en: '10+ years of experience supporting organizations and building systems across multiple sectors.',
          ar: 'أكثر من 10 سنوات من الخبرة في دعم المؤسسات وبناء الأنظمة عبر قطاعات متعددة.',
        },
      },
      {
        title: {
          en: 'Regional + Global Expertise',
          ar: 'خبرة محلية وعالمية',
        },
        description: {
          en: 'Network of experts across 40+ countries enabling scalable and diverse solutions.',
          ar: 'شبكة خبراء عبر أكثر من 40 دولة تتيح حلولًا متنوعة وقابلة للتوسع.',
        },
      },
      {
        title: {
          en: 'Real Impact Delivery',
          ar: 'تحقيق أثر حقيقي',
        },
        description: {
          en: '340+ projects supported through consulting, training, and operational improvement.',
          ar: 'أكثر من 340 مشروعًا تم دعمها عبر الاستشارات والتدريب والتحسين التشغيلي.',
        },
      },
      {
        title: {
          en: 'Program Design Capability',
          ar: 'قدرة على تصميم البرامج',
        },
        description: {
          en: 'We don’t just advise — we build structured systems, programs, and tools.',
          ar: 'نحن لا نقدم الاستشارة فقط، بل نبني أنظمة وبرامج وأدوات منظمة.',
        },
      },
    ],
    stats: [
      {
        value: '+1222',
        label: {
          en: 'Projects Delivered',
          ar: 'مشروع تم تسليمه',
        },
      },
      {
        value: '3,680+',
        label: {
          en: 'Marketing Activities',
          ar: 'نشاط تسويقي',
        },
      },
      {
        value: '30+',
        label: {
          en: 'Websites Developed',
          ar: 'موقع تم تطويره',
        },
      },
      {
        value: '30+',
        label: {
          en: 'Business Plans Built',
          ar: 'خطة عمل تم إعدادها',
        },
      },
    ],
  },

  faq: {
    kicker: {
      en: 'FAQ',
      ar: 'الأسئلة الشائعة',
    },
    title: {
      en: 'Frequently asked questions',
      ar: 'الأسئلة الشائعة',
    },
    subtitle: {
      en: 'Everything you need to know about working with Bawsala.',
      ar: 'كل ما تحتاج معرفته حول العمل مع بوصلة.',
    },
    items: [
      {
        question: {
          en: 'Is there a free trial available?',
          ar: 'هل توجد تجربة مجانية؟',
        },
        answer: {
          en: 'Yes, you can try us for free for 30 days. If you want, we’ll provide you with a free, personalized 30-minute onboarding call to get you up and running as soon as possible.',
          ar: 'نعم، يمكنك تجربتنا مجانًا لمدة 30 يومًا. وإذا أردت، سنوفر لك مكالمة تعريفية مجانية ومخصصة لمدة 30 دقيقة لمساعدتك على البدء بسرعة.',
        },
      },
      {
        question: {
          en: 'Can I change my plan later?',
          ar: 'هل يمكنني تغيير الخطة لاحقًا؟',
        },
        answer: {
          en: 'Yes. You can upgrade or downgrade your plan anytime.',
          ar: 'نعم، يمكنك ترقية خطتك أو تخفيضها في أي وقت.',
        },
      },
      {
        question: {
          en: 'What is your cancellation policy?',
          ar: 'ما هي سياسة الإلغاء لديكم؟',
        },
        answer: {
          en: 'You can cancel your subscription anytime from your account settings.',
          ar: 'يمكنك إلغاء الاشتراك في أي وقت من إعدادات حسابك.',
        },
      },
      {
        question: {
          en: 'Can other info be added to an invoice?',
          ar: 'هل يمكن إضافة معلومات أخرى إلى الفاتورة؟',
        },
        answer: {
          en: 'Yes, additional company information can be added to invoices.',
          ar: 'نعم، يمكن إضافة معلومات إضافية خاصة بالشركة إلى الفواتير.',
        },
      },
      {
        question: {
          en: 'How does billing work?',
          ar: 'كيف تعمل الفوترة؟',
        },
        answer: {
          en: 'Billing is handled monthly or annually depending on your selected plan.',
          ar: 'تتم الفوترة شهريًا أو سنويًا حسب الخطة التي تختارها.',
        },
      },
      {
        question: {
          en: 'How do I change my account email?',
          ar: 'كيف أغير البريد الإلكتروني للحساب؟',
        },
        answer: {
          en: 'You can update your email in your profile settings.',
          ar: 'يمكنك تحديث بريدك الإلكتروني من إعدادات الملف الشخصي.',
        },
      },
    ],
  },
};

const emptyLogo: HeroLogo = {
  name: '',
  image: {
    url: '',
    publicId: '',
  },
};

const emptyService: ServiceItem = {
  icon: '',
  title: { en: '', ar: '' },
  description: { en: '', ar: '' },
  linkText: { en: '', ar: '' },
  linkUrl: '',
};

const emptyResultStat: ResultStat = {
  value: '',
  label: { en: '', ar: '' },
};

const emptyChoiceCard: ChoiceCard = {
  title: { en: '', ar: '' },
  description: { en: '', ar: '' },
};

const emptyChoiceStat: ChoiceStat = {
  value: '',
  label: { en: '', ar: '' },
};

const emptyFaqItem: FaqItem = {
  question: { en: '', ar: '' },
  answer: { en: '', ar: '' },
};

const getTabLabels = (isArabic: boolean): Record<Tab, string> => ({
  hero: isArabic ? 'القسم الرئيسي' : 'Hero',
  services: isArabic ? 'الخدمات' : 'Services',
  results: isArabic ? 'النتائج' : 'Results',
  choose: isArabic ? 'لماذا بوصلة' : 'Why Choose',
  faq: isArabic ? 'الأسئلة الشائعة' : 'FAQ',
});

export const Home: React.FC = () => {
  const { isArabic } = useLanguage();

  const [form, setForm] = useState<HomeContent>(defaultHomeContent);
  const [activeTab, setActiveTab] = useState<Tab>('hero');
  const [imageFiles, setImageFiles] = useState<ImageFiles>({
    heroImage: null,
    resultsAnalysisImage: null,
    resultsPartnerImage: null,
    chooseImage: null,
  });

  const [logoImageFiles, setLogoImageFiles] = useState<Record<number, File | null>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const tabLabels = getTabLabels(isArabic);

  const imagePreviews = useMemo(() => {
    const createPreview = (file: File | null) => (file ? URL.createObjectURL(file) : '');

    return {
      heroImage: createPreview(imageFiles.heroImage),
      resultsAnalysisImage: createPreview(imageFiles.resultsAnalysisImage),
      resultsPartnerImage: createPreview(imageFiles.resultsPartnerImage),
      chooseImage: createPreview(imageFiles.chooseImage),
    };
  }, [imageFiles]);

  const logoImagePreviews = useMemo(() => {
  const previews: Record<number, string> = {};

  Object.entries(logoImageFiles).forEach(([index, file]) => {
    if (file) {
      previews[Number(index)] = URL.createObjectURL(file);
    }
  });

  return previews;
}, [logoImageFiles]);

 useEffect(() => {
  return () => {
    Object.values(imagePreviews).forEach((preview) => {
      if (preview) URL.revokeObjectURL(preview);
    });

    Object.values(logoImagePreviews).forEach((preview) => {
      if (preview) URL.revokeObjectURL(preview);
    });
  };
}, [imagePreviews, logoImagePreviews]);

  useEffect(() => {
    const fetchHomeContent = async () => {
      try {
        const docRef = doc(db, 'siteContent', 'home');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          if (data.hero && data.services && data.results && data.choose && data.faq) {
            setForm({
              ...defaultHomeContent,
              ...(data as Partial<HomeContent>),
            } as HomeContent);
          } else {
            setForm(defaultHomeContent);
          }
        } else {
          setForm(defaultHomeContent);
        }
      } catch (err) {
        console.error(err);
        setError(isArabic ? 'حدث خطأ أثناء جلب البيانات' : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchHomeContent();
  }, [isArabic]);

  const updateLocalized = (
    path: string[],
    language: 'en' | 'ar',
    value: string
  ) => {
    setForm((prev) => {
      const copy: HomeContent = clone(prev);
      let target: any = copy;

      path.forEach((key) => {
        target = target[key];
      });

      target[language] = value;

      return copy;
    });
  };

  const updateField = (path: string[], value: string) => {
    setForm((prev) => {
      const copy: HomeContent = clone(prev);
      let target: any = copy;

      path.slice(0, -1).forEach((key) => {
        target = target[key];
      });

      target[path[path.length - 1]] = value;

      return copy;
    });
  };

  const addArrayItem = <T,>(path: string[], item: T) => {
    setForm((prev) => {
      const copy: HomeContent = clone(prev);
      let target: any = copy;

      path.forEach((key) => {
        target = target[key];
      });

      target.push(item);

      return copy;
    });
  };

  const removeArrayItem = (path: string[], index: number) => {
    setForm((prev) => {
      const copy: HomeContent = clone(prev);
      let target: any = copy;

      path.forEach((key) => {
        target = target[key];
      });

      target.splice(index, 1);

      return copy;
    });
  };

  const handleImageFileChange = (key: ImageKey, file?: File) => {
    setImageFiles((prev) => ({
      ...prev,
      [key]: file || null,
    }));
    
  };

  const handleLogoImageFileChange = (index: number, file?: File) => {
  setLogoImageFiles((prev) => ({
    ...prev,
    [index]: file || null,
  }));
};

  const uploadSelectedImages = async (currentForm: HomeContent): Promise<HomeContent> => {
  const nextForm = clone(currentForm);

  if (imageFiles.heroImage) {
    const uploaded = await uploadImageToCloudinary(imageFiles.heroImage);
    nextForm.hero.image = uploaded;
  }

  if (imageFiles.resultsAnalysisImage) {
    const uploaded = await uploadImageToCloudinary(imageFiles.resultsAnalysisImage);
    nextForm.results.analysisImage = uploaded;
  }

  if (imageFiles.resultsPartnerImage) {
    const uploaded = await uploadImageToCloudinary(imageFiles.resultsPartnerImage);
    nextForm.results.partnerImage = uploaded;
  }

  if (imageFiles.chooseImage) {
    const uploaded = await uploadImageToCloudinary(imageFiles.chooseImage);
    nextForm.choose.image = uploaded;
  }

  const logoEntries = Object.entries(logoImageFiles);

  for (const [indexText, file] of logoEntries) {
    if (!file) continue;

    const index = Number(indexText);

    if (!nextForm.hero.logos[index]) continue;

    const uploaded = await uploadImageToCloudinary(file);
    nextForm.hero.logos[index].image = uploaded;
  }

  return nextForm;
};

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage('');
    setError('');

    try {
      setSaving(true);

      const payload = await uploadSelectedImages(form);

      await setDoc(doc(db, 'siteContent', 'home'), payload, { merge: true });

      setForm(payload);
      setImageFiles({
        heroImage: null,
        resultsAnalysisImage: null,
        resultsPartnerImage: null,
        chooseImage: null,
      });

      setLogoImageFiles({});

      setMessage(
        isArabic
          ? 'تم حفظ محتوى الصفحة الرئيسية بنجاح'
          : 'Home page content saved successfully'
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || (isArabic ? 'حدث خطأ أثناء الحفظ' : 'Error saving data'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold">
          {isArabic ? 'الصفحة الرئيسية' : 'Home Page'}
        </h1>

        <Card>
          <p>{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">
        {isArabic ? 'تعديل الصفحة الرئيسية' : 'Edit Home Page'}
      </h1>

      <Card>
        {message && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          <div className="sticky top-0 z-10 -mx-6 -mt-6 border-b bg-white px-6 pt-6">
            <div className="flex flex-wrap gap-2 pb-4">
              {(Object.keys(tabLabels) as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'hero' && (
            <Section
              title={isArabic ? 'القسم الرئيسي' : 'Hero Section'}
              description={
                isArabic
                  ? 'هذا القسم يتحكم في أول جزء في الصفحة الرئيسية.'
                  : 'This section controls the first hero area on the home page.'
              }
            >
              <TwoColumn>
                <LocalizedInput
                  label={isArabic ? 'نص الشارة' : 'Badge Text'}
                  value={form.hero.badgeText}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'badgeText'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'نص رابط الشارة' : 'Badge Link Text'}
                  value={form.hero.badgeLinkText}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'badgeLinkText'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'العنوان قبل النص المميز' : 'Title Before Highlight'}
                  value={form.hero.titleBeforeHighlight}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'titleBeforeHighlight'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'النص المميز' : 'Highlighted Text'}
                  value={form.hero.highlightedTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'highlightedTitle'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'العنوان بعد النص المميز' : 'Title After Highlight'}
                  value={form.hero.titleAfterHighlight}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'titleAfterHighlight'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'الوصف' : 'Subtitle'}
                  value={form.hero.subtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'subtitle'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'زر أساسي' : 'Primary Button'}
                  value={form.hero.primaryButton}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'primaryButton'], language, value)
                  }
                />

                <Input
                  label={isArabic ? 'رابط الزر الأساسي' : 'Primary Button URL'}
                  value={form.hero.primaryButtonUrl}
                  onChange={(value) => updateField(['hero', 'primaryButtonUrl'], value)}
                />

                <LocalizedInput
                  label={isArabic ? 'زر ثانوي' : 'Secondary Button'}
                  value={form.hero.secondaryButton}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'secondaryButton'], language, value)
                  }
                />

                <Input
                  label={isArabic ? 'رابط الزر الثانوي' : 'Secondary Button URL'}
                  value={form.hero.secondaryButtonUrl}
                  onChange={(value) => updateField(['hero', 'secondaryButtonUrl'], value)}
                />

                <ImageUpload
                  label={isArabic ? 'صورة القسم الرئيسي' : 'Hero Image'}
                  currentUrl={form.hero.image.url}
                  previewUrl={imagePreviews.heroImage}
                  isArabic={isArabic}
                  onChange={(file) => handleImageFileChange('heroImage', file)}
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان بطاقة الثقة' : 'Trust Card Title'}
                  value={form.hero.trustTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'trustTitle'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'حالة بطاقة الثقة' : 'Trust Card Status'}
                  value={form.hero.trustStatus}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['hero', 'trustStatus'], language, value)
                  }
                />
              </TwoColumn>

              <SubSectionHeader
                title={isArabic ? 'شعارات الشركاء' : 'Partner Logos'}
                actionLabel={isArabic ? 'إضافة شعار' : 'Add Logo'}
                onAction={() => addArrayItem(['hero', 'logos'], clone(emptyLogo))}
              />

              <div className="space-y-4">
                {form.hero.logos.map((logo, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `الشعار ${index + 1}` : `Logo ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['hero', 'logos'], index)}
                  >
                    <TwoColumn>
                      <Input
                        label={isArabic ? 'اسم الشعار' : 'Logo Name'}
                        value={logo.name}
                        onChange={(value) =>
                          updateField(['hero', 'logos', String(index), 'name'], value)
                        }
                      />

                      <ImageUpload
  label={isArabic ? 'صورة الشعار' : 'Logo Image'}
  currentUrl={logo.image?.url || ''}
  previewUrl={logoImagePreviews[index] || ''}
  isArabic={isArabic}
  onChange={(file) => handleLogoImageFileChange(index, file)}
/>
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'services' && (
            <Section
              title={isArabic ? 'قسم الخدمات' : 'Services Section'}
              description={
                isArabic
                  ? 'هذا القسم يتحكم في عنوان الخدمات وبطاقات الخدمات الست.'
                  : 'This section controls the services heading and service cards.'
              }
            >
              <TwoColumn>
                <LocalizedInput
                  label={isArabic ? 'النص الصغير' : 'Kicker'}
                  value={form.services.kicker}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['services', 'kicker'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان القسم' : 'Section Title'}
                  value={form.services.title}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['services', 'title'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف القسم' : 'Section Subtitle'}
                  value={form.services.subtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['services', 'subtitle'], language, value)
                  }
                />
              </TwoColumn>

              <SubSectionHeader
                title={isArabic ? 'بطاقات الخدمات' : 'Service Cards'}
                actionLabel={isArabic ? 'إضافة خدمة' : 'Add Service'}
                onAction={() => addArrayItem(['services', 'items'], clone(emptyService))}
              />

              <div className="space-y-4">
                {form.services.items.map((item, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `الخدمة ${index + 1}` : `Service ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['services', 'items'], index)}
                  >
                    <TwoColumn>
                      <Input
                        label={isArabic ? 'الأيقونة' : 'Icon'}
                        value={item.icon}
                        onChange={(value) =>
                          updateField(['services', 'items', String(index), 'icon'], value)
                        }
                      />

                      <LocalizedInput
                        label={isArabic ? 'العنوان' : 'Title'}
                        value={item.title}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['services', 'items', String(index), 'title'],
                            language,
                            value
                          )
                        }
                      />

                      <LocalizedTextarea
                        label={isArabic ? 'الوصف' : 'Description'}
                        value={item.description}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['services', 'items', String(index), 'description'],
                            language,
                            value
                          )
                        }
                      />

                      <LocalizedInput
                        label={isArabic ? 'نص الرابط' : 'Link Text'}
                        value={item.linkText}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['services', 'items', String(index), 'linkText'],
                            language,
                            value
                          )
                        }
                      />

                      <Input
                        label={isArabic ? 'رابط الخدمة' : 'Service Link URL'}
                        value={item.linkUrl}
                        onChange={(value) =>
                          updateField(['services', 'items', String(index), 'linkUrl'], value)
                        }
                      />
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'results' && (
            <Section
              title={isArabic ? 'قسم النتائج' : 'Results Section'}
              description={
                isArabic
                  ? 'هذا القسم يتحكم في Experience You Can Measure و Impact & Scale.'
                  : 'This section controls the measurable results section.'
              }
            >
              <TwoColumn>
                <LocalizedInput
                  label={isArabic ? 'النص الصغير' : 'Kicker'}
                  value={form.results.kicker}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'kicker'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'العنوان الرئيسي' : 'Main Title'}
                  value={form.results.title}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'title'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'الوصف' : 'Subtitle'}
                  value={form.results.subtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'subtitle'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان البطاقة الداكنة' : 'Dark Card Title'}
                  value={form.results.darkCardTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'darkCardTitle'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف البطاقة الداكنة' : 'Dark Card Description'}
                  value={form.results.darkCardDescription}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'darkCardDescription'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'زر البطاقة الداكنة' : 'Dark Card Button'}
                  value={form.results.darkCardButton}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'darkCardButton'], language, value)
                  }
                />

                <Input
                  label={isArabic ? 'رابط زر البطاقة الداكنة' : 'Dark Card Button URL'}
                  value={form.results.darkCardButtonUrl}
                  onChange={(value) =>
                    updateField(['results', 'darkCardButtonUrl'], value)
                  }
                />

                <ImageUpload
                  label={isArabic ? 'صورة التحليل' : 'Analysis Image'}
                  currentUrl={form.results.analysisImage.url}
                  previewUrl={imagePreviews.resultsAnalysisImage}
                  isArabic={isArabic}
                  onChange={(file) => handleImageFileChange('resultsAnalysisImage', file)}
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان صورة التحليل' : 'Analysis Title'}
                  value={form.results.analysisTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'analysisTitle'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف صورة التحليل' : 'Analysis Description'}
                  value={form.results.analysisDescription}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'analysisDescription'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان بطاقة الشريك' : 'Partner Title'}
                  value={form.results.partnerTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'partnerTitle'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف بطاقة الشريك' : 'Partner Description'}
                  value={form.results.partnerDescription}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'partnerDescription'], language, value)
                  }
                />

                <ImageUpload
                  label={isArabic ? 'صورة بطاقة الشريك' : 'Partner Image'}
                  currentUrl={form.results.partnerImage.url}
                  previewUrl={imagePreviews.resultsPartnerImage}
                  isArabic={isArabic}
                  onChange={(file) => handleImageFileChange('resultsPartnerImage', file)}
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان الإحصائيات' : 'Stats Title'}
                  value={form.results.statsTitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'statsTitle'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'وصف الإحصائيات' : 'Stats Subtitle'}
                  value={form.results.statsSubtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['results', 'statsSubtitle'], language, value)
                  }
                />
              </TwoColumn>

              <SubSectionHeader
                title={isArabic ? 'إحصائيات النتائج' : 'Result Stats'}
                actionLabel={isArabic ? 'إضافة إحصائية' : 'Add Stat'}
                onAction={() => addArrayItem(['results', 'stats'], clone(emptyResultStat))}
              />

              <div className="space-y-4">
                {form.results.stats.map((stat, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `إحصائية ${index + 1}` : `Stat ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['results', 'stats'], index)}
                  >
                    <TwoColumn>
                      <Input
                        label={isArabic ? 'القيمة' : 'Value'}
                        value={stat.value}
                        onChange={(value) =>
                          updateField(['results', 'stats', String(index), 'value'], value)
                        }
                      />

                      <LocalizedInput
                        label={isArabic ? 'العنوان' : 'Label'}
                        value={stat.label}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['results', 'stats', String(index), 'label'],
                            language,
                            value
                          )
                        }
                      />
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'choose' && (
            <Section
              title={isArabic ? 'قسم لماذا تختار بوصلة' : 'Why Choose Section'}
              description={
                isArabic
                  ? 'هذا القسم يتحكم في الجزء الداكن في أسفل الصفحة.'
                  : 'This section controls the dark why organizations choose Bawsala area.'
              }
            >
              <TwoColumn>
                <LocalizedInput
                  label={isArabic ? 'عنوان القسم' : 'Section Title'}
                  value={form.choose.title}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['choose', 'title'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف القسم' : 'Section Subtitle'}
                  value={form.choose.subtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['choose', 'subtitle'], language, value)
                  }
                />

                <ImageUpload
                  label={isArabic ? 'صورة القسم' : 'Section Image'}
                  currentUrl={form.choose.image.url}
                  previewUrl={imagePreviews.chooseImage}
                  isArabic={isArabic}
                  onChange={(file) => handleImageFileChange('chooseImage', file)}
                />
              </TwoColumn>

              <SubSectionHeader
                title={isArabic ? 'بطاقات الأسباب' : 'Reason Cards'}
                actionLabel={isArabic ? 'إضافة بطاقة' : 'Add Card'}
                onAction={() => addArrayItem(['choose', 'cards'], clone(emptyChoiceCard))}
              />

              <div className="space-y-4">
                {form.choose.cards.map((card, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `بطاقة ${index + 1}` : `Card ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['choose', 'cards'], index)}
                  >
                    <TwoColumn>
                      <LocalizedInput
                        label={isArabic ? 'العنوان' : 'Title'}
                        value={card.title}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['choose', 'cards', String(index), 'title'],
                            language,
                            value
                          )
                        }
                      />

                      <LocalizedTextarea
                        label={isArabic ? 'الوصف' : 'Description'}
                        value={card.description}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['choose', 'cards', String(index), 'description'],
                            language,
                            value
                          )
                        }
                      />
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>

              <SubSectionHeader
                title={isArabic ? 'إحصائيات القسم' : 'Section Stats'}
                actionLabel={isArabic ? 'إضافة إحصائية' : 'Add Stat'}
                onAction={() => addArrayItem(['choose', 'stats'], clone(emptyChoiceStat))}
              />

              <div className="space-y-4">
                {form.choose.stats.map((stat, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `إحصائية ${index + 1}` : `Stat ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['choose', 'stats'], index)}
                  >
                    <TwoColumn>
                      <Input
                        label={isArabic ? 'القيمة' : 'Value'}
                        value={stat.value}
                        onChange={(value) =>
                          updateField(['choose', 'stats', String(index), 'value'], value)
                        }
                      />

                      <LocalizedInput
                        label={isArabic ? 'العنوان' : 'Label'}
                        value={stat.label}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['choose', 'stats', String(index), 'label'],
                            language,
                            value
                          )
                        }
                      />
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'faq' && (
            <Section
              title={isArabic ? 'قسم الأسئلة الشائعة' : 'FAQ Section'}
              description={
                isArabic
                  ? 'هذا القسم يتحكم في الأسئلة الشائعة في الصفحة الرئيسية.'
                  : 'This section controls the FAQ items on the home page.'
              }
            >
              <TwoColumn>
                <LocalizedInput
                  label={isArabic ? 'النص الصغير' : 'Kicker'}
                  value={form.faq.kicker}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['faq', 'kicker'], language, value)
                  }
                />

                <LocalizedInput
                  label={isArabic ? 'عنوان القسم' : 'Section Title'}
                  value={form.faq.title}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['faq', 'title'], language, value)
                  }
                />

                <LocalizedTextarea
                  label={isArabic ? 'وصف القسم' : 'Section Subtitle'}
                  value={form.faq.subtitle}
                  isArabic={isArabic}
                  onChange={(language, value) =>
                    updateLocalized(['faq', 'subtitle'], language, value)
                  }
                />
              </TwoColumn>

              <SubSectionHeader
                title={isArabic ? 'الأسئلة' : 'Questions'}
                actionLabel={isArabic ? 'إضافة سؤال' : 'Add Question'}
                onAction={() => addArrayItem(['faq', 'items'], clone(emptyFaqItem))}
              />

              <div className="space-y-4">
                {form.faq.items.map((item, index) => (
                  <ItemBox
                    key={index}
                    title={isArabic ? `السؤال ${index + 1}` : `Question ${index + 1}`}
                    removeLabel={isArabic ? 'حذف' : 'Remove'}
                    onRemove={() => removeArrayItem(['faq', 'items'], index)}
                  >
                    <TwoColumn>
                      <LocalizedInput
                        label={isArabic ? 'السؤال' : 'Question'}
                        value={item.question}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['faq', 'items', String(index), 'question'],
                            language,
                            value
                          )
                        }
                      />

                      <LocalizedTextarea
                        label={isArabic ? 'الإجابة' : 'Answer'}
                        value={item.answer}
                        isArabic={isArabic}
                        onChange={(language, value) =>
                          updateLocalized(
                            ['faq', 'items', String(index), 'answer'],
                            language,
                            value
                          )
                        }
                      />
                    </TwoColumn>
                  </ItemBox>
                ))}
              </div>
            </Section>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 border-t bg-white px-6 py-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving
                ? isArabic
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : isArabic
                ? 'حفظ التغييرات'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, description, children }) => {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>

      <div className="space-y-6">{children}</div>
    </section>
  );
};

interface SubSectionHeaderProps {
  title: string;
  actionLabel: string;
  onAction: () => void;
}

const SubSectionHeader: React.FC<SubSectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      <button
        type="button"
        onClick={onAction}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
      >
        {actionLabel}
      </button>
    </div>
  );
};

interface ItemBoxProps {
  title: string;
  children: React.ReactNode;
  onRemove: () => void;
  removeLabel: string;
}

const ItemBox: React.FC<ItemBoxProps> = ({
  title,
  children,
  onRemove,
  removeLabel,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
        <h4 className="font-semibold text-gray-900">{title}</h4>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
        >
          {removeLabel}
        </button>
      </div>

      {children}
    </div>
  );
};

interface TwoColumnProps {
  children: React.ReactNode;
}

const TwoColumn: React.FC<TwoColumnProps> = ({ children }) => {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
};

interface LocalizedInputProps {
  label: string;
  value: LocalizedText;
  isArabic: boolean;
  onChange: (language: 'en' | 'ar', value: string) => void;
}

const LocalizedInput: React.FC<LocalizedInputProps> = ({
  label,
  value,
  isArabic,
  onChange,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">{label}</h4>

      <div className="space-y-3">
        <Input
          label={isArabic ? 'الإنجليزية' : 'English'}
          value={value.en}
          onChange={(newValue) => onChange('en', newValue)}
        />

        <div dir="rtl">
          <Input
            label={isArabic ? 'العربية' : 'Arabic'}
            value={value.ar}
            onChange={(newValue) => onChange('ar', newValue)}
          />
        </div>
      </div>
    </div>
  );
};

interface LocalizedTextareaProps {
  label: string;
  value: LocalizedText;
  isArabic: boolean;
  onChange: (language: 'en' | 'ar', value: string) => void;
}

const LocalizedTextarea: React.FC<LocalizedTextareaProps> = ({
  label,
  value,
  isArabic,
  onChange,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">{label}</h4>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Textarea
          label={isArabic ? 'الإنجليزية' : 'English'}
          value={value.en}
          onChange={(newValue) => onChange('en', newValue)}
        />

        <div dir="rtl">
          <Textarea
            label={isArabic ? 'العربية' : 'Arabic'}
            value={value.ar}
            onChange={(newValue) => onChange('ar', newValue)}
          />
        </div>
      </div>
    </div>
  );
};

interface ImageUploadProps {
  label: string;
  currentUrl: string;
  previewUrl: string;
  isArabic: boolean;
  onChange: (file?: File) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  currentUrl,
  previewUrl,
  isArabic,
  onChange,
}) => {
  const imageUrl = previewUrl || currentUrl;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <h4 className="mb-3 text-sm font-semibold text-gray-900">{label}</h4>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0])}
        className="w-full rounded-lg border border-gray-300 px-4 py-2"
      />

      {imageUrl && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            {previewUrl
              ? isArabic
                ? 'معاينة الصورة الجديدة'
                : 'New Image Preview'
              : isArabic
              ? 'الصورة الحالية'
              : 'Current Image'}
          </p>

          <img
            src={imageUrl}
            alt={label}
            className="h-48 w-full rounded-lg object-cover"
          />
        </div>
      )}
    </div>
  );
};

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const Input: React.FC<InputProps> = ({ label, value, onChange }) => {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};

interface TextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const Textarea: React.FC<TextareaProps> = ({ label, value, onChange }) => {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};