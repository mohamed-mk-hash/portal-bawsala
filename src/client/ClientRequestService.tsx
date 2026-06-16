import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle,
  Globe2,
  Megaphone,
  Send,
  Settings2,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type CurrencyCode = 'USD' | 'EUR' | 'CNY' | 'DZD' | 'SAR' | 'TRY';

type BillingPeriod = 'once' | 'monthly' | 'campaign';

type Plan = {
  id: string;
  nameAr: string;
  nameEn: string;
  priceAr: string;
  priceEn: string;
  basePriceDzd?: number;
  minPriceDzd?: number;
  maxPriceDzd?: number;
  billingPeriod?: BillingPeriod;
  isCustomPricing?: boolean;
  descriptionAr: string;
  descriptionEn: string;
  featuresAr: string[];
  featuresEn: string[];
};

type ClientService = {
  id: string;
  nameAr: string;
  nameEn: string;
  subtitleAr: string;
  subtitleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: React.ElementType;
  plans: Plan[];
};

const BASE_CURRENCY: CurrencyCode = 'DZD';
const EXCHANGE_API_URL = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

const currencies: {
  value: CurrencyCode;
  ar: string;
  en: string;
}[] = [
  { value: 'USD', ar: 'دولار أمريكي', en: 'US Dollar' },
  { value: 'EUR', ar: 'أورو', en: 'Euro' },
  { value: 'CNY', ar: 'يوان صيني', en: 'Chinese Yuan' },
  { value: 'DZD', ar: 'دينار جزائري', en: 'Algerian Dinar' },
  { value: 'SAR', ar: 'ريال سعودي', en: 'Saudi Riyal' },
  { value: 'TRY', ar: 'ليرة تركية', en: 'Turkish Lira' },
];

const currencyDecimals: Record<CurrencyCode, number> = {
  DZD: 0,
  USD: 2,
  EUR: 2,
  CNY: 2,
  SAR: 2,
  TRY: 2,
};

const getCurrencyRate = (
  currency: CurrencyCode,
  rates: Record<string, number>
) => {
  if (currency === BASE_CURRENCY) return 1;
  return rates[currency] || 0;
};

const formatMoney = (
  amount: number,
  currency: CurrencyCode,
  isArabic: boolean
) => {
  return `${Number(amount || 0).toLocaleString(isArabic ? 'ar-DZ' : 'en-US', {
    minimumFractionDigits: currency === 'DZD' ? 0 : 2,
    maximumFractionDigits: currencyDecimals[currency],
  })} ${currency}`;
};

const getBillingSuffix = (
  billingPeriod: BillingPeriod | undefined,
  isArabic: boolean
) => {
  if (billingPeriod === 'monthly') {
    return isArabic ? ' / شهرياً' : ' / month';
  }

  if (billingPeriod === 'campaign') {
    return isArabic ? ' / حملة' : ' / campaign';
  }

  return '';
};

const getConvertedPlanPrice = ({
  plan,
  currency,
  rates,
  isArabic,
  ratesLoading,
}: {
  plan: Plan;
  currency: CurrencyCode;
  rates: Record<string, number>;
  isArabic: boolean;
  ratesLoading: boolean;
}) => {
  if (plan.isCustomPricing) {
    return isArabic ? 'تسعير حسب الطلب' : 'Custom pricing';
  }

  const rate = getCurrencyRate(currency, rates);

  if (!rate) {
    return ratesLoading
      ? isArabic
        ? 'جاري تحويل السعر...'
        : 'Converting price...'
      : isArabic
      ? 'تعذر تحويل السعر'
      : 'Could not convert price';
  }

  const suffix = getBillingSuffix(plan.billingPeriod, isArabic);

  if (
    typeof plan.minPriceDzd === 'number' &&
    typeof plan.maxPriceDzd === 'number'
  ) {
    const min = plan.minPriceDzd * rate;
    const max = plan.maxPriceDzd * rate;

    return isArabic
      ? `من ${formatMoney(min, currency, isArabic)} إلى ${formatMoney(
          max,
          currency,
          isArabic
        )}${suffix}`
      : `From ${formatMoney(min, currency, isArabic)} to ${formatMoney(
          max,
          currency,
          isArabic
        )}${suffix}`;
  }

  if (typeof plan.basePriceDzd === 'number') {
    const convertedPrice = plan.basePriceDzd * rate;

    return isArabic
      ? `ابتداءً من ${formatMoney(convertedPrice, currency, isArabic)}${suffix}`
      : `Starting from ${formatMoney(
          convertedPrice,
          currency,
          isArabic
        )}${suffix}`;
  }

  return isArabic ? plan.priceAr : plan.priceEn;
};

const services: ClientService[] = [
  {
    id: 'administrative-development',
    nameAr: 'التطوير الإداري',
    nameEn: 'Administrative Development',
    subtitleAr: 'طوّر عملياتك الإدارية بحلول عملية ومناسبة',
    subtitleEn: 'Improve your internal operations with practical solutions',
    descriptionAr:
      'خدمة تساعد المؤسسات على تنظيم العمل الداخلي، توضيح المسؤوليات، تحسين سير العمليات، وبناء أدوات إدارية تناسب احتياجات المؤسسة.',
    descriptionEn:
      'A service that helps companies organize internal work, clarify responsibilities, improve operations, and build practical administrative tools.',
    icon: Settings2,
    plans: [
      {
        id: 'basic',
        nameAr: 'أساسي',
        nameEn: 'Basic',
        priceAr: 'ابتداءً من 70,000 دج',
        priceEn: 'Starting from 70,000 DZD',
        basePriceDzd: 70000,
        billingPeriod: 'once',
        descriptionAr: 'مناسب للمؤسسات التي تحتاج إلى مراجعة مبسطة ودعم أساسي.',
        descriptionEn:
          'Suitable for companies that need a simple review and basic support.',
        featuresAr: [
          'تشخيص إداري أولي',
          'مراجعة أساسية لسير العمل',
          'توصيات إدارية',
          'نماذج أو قوائم تحقق بسيطة',
          'تسليم عادي',
        ],
        featuresEn: [
          'Initial administrative diagnosis',
          'Basic workflow review',
          'Administrative recommendations',
          'Simple templates or checklists',
          'Standard delivery',
        ],
      },
      {
        id: 'professional',
        nameAr: 'احترافي',
        nameEn: 'Professional',
        priceAr: 'تسعير حسب الطلب',
        priceEn: 'Custom pricing',
        isCustomPricing: true,
        descriptionAr:
          'مناسب للمؤسسات التي تحتاج إلى خطة تطوير إداري أكثر شمولاً وفعالية.',
        descriptionEn:
          'Suitable for companies that need a more complete and effective administrative development plan.',
        featuresAr: [
          'تشخيص إداري مفصل',
          'خطة تحسين سير العمل',
          'نماذج وأدوات مخصصة',
          'توصيات للتنفيذ',
          'جلسات مراجعة',
          'دعم ومتابعة',
        ],
        featuresEn: [
          'Detailed administrative diagnosis',
          'Workflow improvement plan',
          'Custom templates and tools',
          'Implementation recommendations',
          'Review sessions',
          'Support and follow-up',
        ],
      },
    ],
  },
  {
    id: 'social-media-management',
    nameAr: 'إدارة مواقع التواصل',
    nameEn: 'Social Media Management',
    subtitleAr: 'إدارة حضور علامتك على منصات التواصل',
    subtitleEn: 'Manage your brand presence on social media',
    descriptionAr:
      'خدمة تساعد المؤسسات على بناء حضور احترافي ومنظم على منصات التواصل من خلال التخطيط، صناعة المحتوى، الجدولة، ومتابعة الأداء.',
    descriptionEn:
      'A service that helps companies build a professional social media presence through planning, content creation, scheduling, and performance tracking.',
    icon: Megaphone,
    plans: [
      {
        id: 'starter',
        nameAr: 'باقة الانطلاق لإدارة التواصل',
        nameEn: 'Starter Social Media Package',
        priceAr: 'ابتداءً من 25,000 دج / شهرياً',
        priceEn: 'Starting from 25,000 DZD / month',
        basePriceDzd: 25000,
        billingPeriod: 'monthly',
        descriptionAr: 'مناسبة للمؤسسات الصغيرة التي تحتاج إلى حضور أساسي ومنظم.',
        descriptionEn:
          'Suitable for small companies that need a simple and organized presence.',
        featuresAr: [
          'منصة واحدة',
          '8 منشورات شهرياً',
          'جدول محتوى أساسي',
          'تصاميم بسيطة للمنشورات',
          'كتابة النصوص',
          'دعم النشر',
          'ملخص شهري أساسي',
        ],
        featuresEn: [
          'One platform',
          '8 posts per month',
          'Basic content calendar',
          'Simple post designs',
          'Copywriting',
          'Publishing support',
          'Basic monthly summary',
        ],
      },
      {
        id: 'growth',
        nameAr: 'باقة النمو لمواقع التواصل',
        nameEn: 'Social Media Growth Package',
        priceAr: 'من 50,000 إلى 80,000 دج / شهرياً',
        priceEn: 'From 50,000 to 80,000 DZD / month',
        minPriceDzd: 50000,
        maxPriceDzd: 80000,
        billingPeriod: 'monthly',
        descriptionAr: 'مناسبة للمؤسسات التي تحتاج إلى محتوى منظم وجودة بصرية أفضل.',
        descriptionEn:
          'Suitable for companies that need organized content and better visual quality.',
        featuresAr: [
          'حتى منصتين للتواصل الاجتماعي',
          'من 12 إلى 16 منشوراً شهرياً',
          'جدول محتوى شهري',
          'تصاميم مخصصة للمنشورات',
          'كتابة النصوص والهاشتاغات',
          'النشر والجدولة',
          'رسائل أساسية لإدارة التفاعل',
          'تقرير أداء شهري',
        ],
        featuresEn: [
          'Up to two platforms',
          '12 to 16 posts per month',
          'Monthly content calendar',
          'Custom post designs',
          'Copywriting and hashtags',
          'Publishing and scheduling',
          'Basic engagement replies',
          'Monthly performance report',
        ],
      },
      {
        id: 'professional',
        nameAr: 'باقة احترافية لإدارة التواصل',
        nameEn: 'Professional Social Media Package',
        priceAr: 'ابتداءً من 100,000 دج / شهرياً',
        priceEn: 'Starting from 100,000 DZD / month',
        basePriceDzd: 100000,
        billingPeriod: 'monthly',
        descriptionAr:
          'مناسبة للعلامات التي تحتاج إلى إنتاج محتوى أقوى وإدارة منتظمة.',
        descriptionEn:
          'Suitable for brands that need stronger content and regular management.',
        featuresAr: [
          'من 2 إلى 3 منصات تواصل اجتماعي',
          'من 18 إلى 24 منشوراً شهرياً',
          'جدول محتوى متقدم',
          'اتجاه بصري مخصص',
          'تصميم المنشورات وكتابة النصوص',
          'النشر والجدولة',
          'دعم إدارة التفاعل',
          'تقرير أداء شهري',
          'دعم تخطيط الحملات',
        ],
        featuresEn: [
          '2 to 3 social platforms',
          '18 to 24 posts per month',
          'Advanced content calendar',
          'Custom visual direction',
          'Post design and copywriting',
          'Publishing and scheduling',
          'Engagement support',
          'Monthly performance report',
          'Campaign planning support',
        ],
      },
      {
        id: 'campaign',
        nameAr: 'باقة إطلاق حملة',
        nameEn: 'Campaign Launch Package',
        priceAr: 'ابتداءً من 60,000 دج / حملة',
        priceEn: 'Starting from 60,000 DZD / campaign',
        basePriceDzd: 60000,
        billingPeriod: 'campaign',
        descriptionAr: 'مناسبة لإطلاق عرض أو منتج أو خدمة أو حملة موسمية.',
        descriptionEn:
          'Suitable for launching an offer, product, service, or seasonal campaign.',
        featuresAr: [
          'فكرة الحملة',
          'خطة محتوى الحملة',
          'اتجاه بصري للحملة',
          'تصميم منشورات وستوري',
          'كتابة نصوص الحملة',
          'جدول نشر الحملة',
          'ملخص أداء الحملة',
        ],
        featuresEn: [
          'Campaign idea',
          'Campaign content plan',
          'Campaign visual direction',
          'Posts and stories design',
          'Campaign copywriting',
          'Publishing schedule',
          'Campaign performance summary',
        ],
      },
    ],
  },
  {
    id: 'website-design-management',
    nameAr: 'تصميم وإدارة المواقع',
    nameEn: 'Website Design & Management',
    subtitleAr: 'تصميم وتطوير وإدارة موقع إلكتروني حسب أهدافك',
    subtitleEn: 'Design, develop, and manage a website based on your goals',
    descriptionAr:
      'خدمة تساعد المؤسسات على بناء حضور رقمي احترافي من خلال تخطيط الموقع، التصميم، التطوير، وإدارة الموقع بعد الإطلاق.',
    descriptionEn:
      'A service that helps companies build a professional digital presence through website planning, design, development, and post-launch management.',
    icon: Globe2,
    plans: [
      {
        id: 'simple',
        nameAr: 'موقع تعريفي بسيط',
        nameEn: 'Simple Business Website',
        priceAr: 'ابتداءً من 70,000 دج',
        priceEn: 'Starting from 70,000 DZD',
        basePriceDzd: 70000,
        billingPeriod: 'once',
        descriptionAr: 'مناسب لموقع تعريفي بسيط بنطاق واضح وعدد صفحات محدود.',
        descriptionEn:
          'Suitable for a simple business website with a clear scope and limited pages.',
        featuresAr: [
          'من 1 إلى 3 صفحات',
          'تصميم متجاوب',
          'تنظيم أساسي للمحتوى',
          'نموذج تواصل أو طلب خدمة',
          'بنية SEO أساسية',
          'نشر عادي للموقع',
        ],
        featuresEn: [
          '1 to 3 pages',
          'Responsive design',
          'Basic content structure',
          'Contact or service request form',
          'Basic SEO structure',
          'Standard website publishing',
        ],
      },
      {
        id: 'professional',
        nameAr: 'موقع أعمال احترافي',
        nameEn: 'Professional Business Website',
        priceAr: 'من 140,000 إلى 180,000 دج',
        priceEn: 'From 140,000 to 180,000 DZD',
        minPriceDzd: 140000,
        maxPriceDzd: 180000,
        billingPeriod: 'once',
        descriptionAr: 'مناسب لموقع أعمال احترافي بعدة صفحات وهيكلة أفضل.',
        descriptionEn:
          'Suitable for a professional business website with more pages and better structure.',
        featuresAr: [
          'من 4 إلى 8 صفحات',
          'تصميم متجاوب مخصص جزئياً',
          'دعم المحتوى بلغتين',
          'لوحة تحكم أو إدارة محتوى بسيطة',
          'نماذج أو أقسام متعددة',
          'ربط خارجي بسيط',
          'حماية واختبار بمستوى متوسط',
          'نشر على بيئة إنتاج',
        ],
        featuresEn: [
          '4 to 8 pages',
          'Partially custom responsive design',
          'Bilingual content support',
          'Simple CMS or admin panel',
          'Multiple forms or sections',
          'Simple external integrations',
          'Medium-level testing and security',
          'Production deployment',
        ],
      },
      {
        id: 'advanced',
        nameAr: 'موقع أو منصة متقدمة',
        nameEn: 'Advanced Website or Platform',
        priceAr: 'ابتداءً من 300,000 دج',
        priceEn: 'Starting from 300,000 DZD',
        basePriceDzd: 300000,
        billingPeriod: 'once',
        descriptionAr:
          'مناسب للمواقع أو المنصات المتقدمة التي تحتاج إلى حسابات ولوحات تحكم وتكاملات.',
        descriptionEn:
          'Suitable for advanced websites or platforms that need accounts, dashboards, and integrations.',
        featuresAr: [
          'أكثر من 8 صفحات أو هيكلة متقدمة',
          'تصميم مخصص بالكامل',
          'حسابات مستخدمين عند الحاجة',
          'لوحة تحكم متقدمة',
          'قاعدة بيانات معقدة',
          'ربط مع APIs أو خدمات خارجية',
          'حماية واختبار متقدم',
          'إعداد قابل للتوسع',
        ],
        featuresEn: [
          'More than 8 pages or advanced structure',
          'Fully custom design',
          'User accounts when needed',
          'Advanced admin panel',
          'Complex database',
          'APIs or external services integration',
          'Advanced security and testing',
          'Scalable setup',
        ],
      },
      {
        id: 'monthly-management',
        nameAr: 'إدارة شهرية للموقع',
        nameEn: 'Monthly Website Management',
        priceAr: 'ابتداءً من 15,000 دج / شهرياً',
        priceEn: 'Starting from 15,000 DZD / month',
        basePriceDzd: 15000,
        billingPeriod: 'monthly',
        descriptionAr:
          'مناسبة للمؤسسات التي تحتاج إلى تحديثات مستمرة بعد إطلاق الموقع.',
        descriptionEn:
          'Suitable for companies that need continuous updates after launch.',
        featuresAr: [
          'تحديثات المحتوى',
          'إصلاحات تقنية بسيطة',
          'مراقبة الموقع',
          'دعم الأداء',
          'فحص الحماية عند الحاجة',
          'دعم شهري',
        ],
        featuresEn: [
          'Content updates',
          'Simple technical fixes',
          'Website monitoring',
          'Performance support',
          'Security checks when needed',
          'Monthly support',
        ],
      },
    ],
  },
];

export const ClientRequestService: React.FC = () => {
  const { user, profile } = useAuth();
  const { isArabic } = useLanguage();

  const [selectedServiceId, setSelectedServiceId] = useState(services[0].id);
  const [selectedPlanId, setSelectedPlanId] = useState(services[0].plans[0].id);
  const [selectedCurrency, setSelectedCurrency] =
    useState<CurrencyCode>('DZD');

  const [rates, setRates] = useState<Record<string, number>>({ DZD: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');
  const [ratesLastUpdated, setRatesLastUpdated] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadExchangeRates = async () => {
      try {
        setRatesLoading(true);
        setRatesError('');

        const response = await fetch(EXCHANGE_API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load exchange rates.');
        }

        const data = await response.json();

        if (data.result !== 'success' || !data.rates) {
          throw new Error('Invalid exchange rate response.');
        }

        const supportedRates: Record<string, number> = {
          DZD: 1,
        };

        currencies.forEach((currency) => {
          const value = currency.value;

          if (value === BASE_CURRENCY) {
            supportedRates[value] = 1;
          } else if (typeof data.rates[value] === 'number') {
            supportedRates[value] = data.rates[value];
          }
        });

        if (isMounted) {
          setRates(supportedRates);
          setRatesLastUpdated(data.time_last_update_utc || '');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        console.error(error);

        if (isMounted) {
          setRatesError(
            isArabic
              ? 'تعذر تحميل أسعار الصرف حالياً. يمكنك استعمال الدينار الجزائري أو المحاولة لاحقاً.'
              : 'Could not load exchange rates right now. You can use DZD or try again later.'
          );
        }
      } finally {
        if (isMounted) {
          setRatesLoading(false);
        }
      }
    };

    loadExchangeRates();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isArabic]);

 useEffect(() => {
  if (!successMessage && !errorMessage) return;

  window.setTimeout(() => {
    feedbackRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, 100);
}, [successMessage, errorMessage]);

  const selectedService =
    services.find((service) => service.id === selectedServiceId) || services[0];

  const selectedPlan =
    selectedService.plans.find((plan) => plan.id === selectedPlanId) ||
    selectedService.plans[0];

  const selectedCurrencyRate = getCurrencyRate(selectedCurrency, rates);

  const selectedPlanPrice = getConvertedPlanPrice({
    plan: selectedPlan,
    currency: selectedCurrency,
    rates,
    isArabic,
    ratesLoading,
  });

  const canUseSelectedCurrency =
    selectedCurrency === BASE_CURRENCY ||
    selectedPlan.isCustomPricing ||
    Boolean(selectedCurrencyRate);

  const requestDisabled =
    loading ||
    !canUseSelectedCurrency ||
    (ratesLoading &&
      selectedCurrency !== BASE_CURRENCY &&
      !selectedPlan.isCustomPricing);

  const handleSelectService = (service: ClientService) => {
    setSelectedServiceId(service.id);
    setSelectedPlanId(service.plans[0].id);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const requestService = async () => {
    try {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');

      if (!user || !profile) {
        setErrorMessage(
          isArabic
            ? 'لم يتم العثور على بيانات الحساب. يرجى تسجيل الدخول من جديد.'
            : 'Account information was not found. Please log in again.'
        );
        return;
      }

      if (!canUseSelectedCurrency) {
        setErrorMessage(
          isArabic
            ? 'تعذر تحويل السعر للعملة المختارة. اختر الدينار الجزائري أو حاول لاحقاً.'
            : 'Could not convert the price to the selected currency. Choose DZD or try again later.'
        );
        return;
      }

      const planPriceAr = getConvertedPlanPrice({
        plan: selectedPlan,
        currency: selectedCurrency,
        rates,
        isArabic: true,
        ratesLoading: false,
      });

      const planPriceEn = getConvertedPlanPrice({
        plan: selectedPlan,
        currency: selectedCurrency,
        rates,
        isArabic: false,
        ratesLoading: false,
      });

      await addDoc(collection(db, 'serviceRequests'), {
        clientId: user.uid,
        clientName: profile.fullName,
        clientEmail: profile.email,
        companyName: profile.companyName || '',

        serviceId: selectedService.id,
        serviceName: isArabic ? selectedService.nameAr : selectedService.nameEn,
        serviceNameAr: selectedService.nameAr,
        serviceNameEn: selectedService.nameEn,

        planId: selectedPlan.id,
        planName: isArabic ? selectedPlan.nameAr : selectedPlan.nameEn,
        planNameAr: selectedPlan.nameAr,
        planNameEn: selectedPlan.nameEn,

        planPrice: isArabic ? planPriceAr : planPriceEn,
        planPriceAr,
        planPriceEn,

        planCurrency: selectedCurrency,
        planBaseCurrency: BASE_CURRENCY,
        currencyRateFromDzd: selectedCurrencyRate || 1,
        currencyRateUpdatedAt: ratesLastUpdated || '',

        planBasePriceDzd: selectedPlan.basePriceDzd ?? null,
        planBaseMinPriceDzd: selectedPlan.minPriceDzd ?? null,
        planBaseMaxPriceDzd: selectedPlan.maxPriceDzd ?? null,
        planBillingPeriod: selectedPlan.billingPeriod || 'once',
        isCustomPricing: Boolean(selectedPlan.isCustomPricing),

        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setSuccessMessage(
        isArabic
          ? 'تم إرسال طلبك بنجاح. ستقوم الإدارة بمراجعته ثم قبول الطلب أو رفضه.'
          : 'Your request was sent successfully. The admin team will review it and then accept or refuse it.'
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        isArabic
          ? 'حدث خطأ أثناء إرسال الطلب. تأكد من صلاحيات Firestore ثم حاول مرة أخرى.'
          : 'Something went wrong while sending the request. Check Firestore permissions and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const Icon = selectedService.icon;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isArabic ? 'طلب خدمة' : 'Request a New Service'}
        </h1>
        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'اختر الخدمة المناسبة، ثم اختر الباقة التي تريدها. يمكنك أيضاً تغيير عملة عرض الأسعار حسب بلدك.'
            : 'Choose a service, then select the plan you want. You can also change the displayed currency based on your country.'}
        </p>
      </div>

      

      {successMessage && (
  <div
    ref={feedbackRef}
    className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 font-medium"
  >
          <div className="flex items-start justify-between gap-4">
            <p>{successMessage}</p>
            <button
              onClick={() => setSuccessMessage('')}
              className="font-bold text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
  <div
    ref={feedbackRef}
    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 font-medium"
  >
          <div className="flex items-start justify-between gap-4">
            <p>{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="font-bold text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-5">
          {isArabic ? 'الخدمات المتاحة' : 'Available Services'}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const ServiceIcon = service.icon;
            const active = selectedServiceId === service.id;

            return (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className={`text-start rounded-2xl border p-5 transition hover:-translate-y-1 hover:shadow-md ${
                  active
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`rounded-2xl p-3 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-blue-600'
                    }`}
                  >
                    <ServiceIcon className="h-6 w-6" />
                  </div>

                  {active && (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900">
                  {isArabic ? service.nameAr : service.nameEn}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {isArabic ? service.subtitleAr : service.subtitleEn}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-2xl bg-blue-100 p-4 text-blue-600">
            <Icon className="h-7 w-7" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isArabic ? selectedService.nameAr : selectedService.nameEn}
            </h2>
            <p className="mt-2 max-w-3xl leading-8 text-gray-600">
              {isArabic
                ? selectedService.descriptionAr
                : selectedService.descriptionEn}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <label className="mb-2 block text-sm font-bold text-gray-700">
            {isArabic ? 'عملة عرض الأسعار' : 'Price Display Currency'}
          </label>

          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value as CurrencyCode)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {currencies.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.value} — {isArabic ? currency.ar : currency.en}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs leading-6 text-gray-500">
            {isArabic
              ? 'الأسعار الأصلية بالدينار الجزائري، ويتم تحويلها تلقائياً حسب أسعار الصرف الحالية.'
              : 'Original prices are in Algerian Dinar and are automatically converted using current exchange rates.'}
          </p>

          {ratesLoading && (
            <p className="mt-2 text-xs font-semibold text-blue-600">
              {isArabic
                ? 'جاري تحميل أسعار الصرف...'
                : 'Loading exchange rates...'}
            </p>
          )}

          {ratesError && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              {ratesError}
            </p>
          )}

          {ratesLastUpdated && !ratesLoading && (
            <p className="mt-2 text-xs text-gray-400">
              {isArabic
                ? `آخر تحديث لسعر الصرف: ${ratesLastUpdated}`
                : `Exchange rate last updated: ${ratesLastUpdated}`}
            </p>
          )}
        </div>

        <h3 className="mb-4 text-lg font-semibold">
          {isArabic ? 'اختر الباقة' : 'Choose a Plan'}
        </h3>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {selectedService.plans.map((plan) => {
            const active = selectedPlanId === plan.id;

            const displayPrice = getConvertedPlanPrice({
              plan,
              currency: selectedCurrency,
              rates,
              isArabic,
              ratesLoading,
            });

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`text-start rounded-3xl border p-6 transition hover:-translate-y-1 hover:shadow-lg ${
                  active
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">
                      {isArabic ? plan.nameAr : plan.nameEn}
                    </h4>
                    <p className="mt-2 text-2xl font-black text-blue-600">
                      {displayPrice}
                    </p>
                  </div>

                  {active && (
                    <div className="rounded-full bg-blue-600 p-1 text-white">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <p className="mb-5 leading-7 text-gray-600">
                  {isArabic ? plan.descriptionAr : plan.descriptionEn}
                </p>

                <div className="space-y-3">
                  {(isArabic ? plan.featuresAr : plan.featuresEn).map(
                    (feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
                        <span className="text-sm leading-6 text-gray-600">
                          {feature}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-sm text-gray-500">
            {isArabic ? 'الخدمة المختارة' : 'Selected service'}
          </p>

          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {isArabic ? selectedService.nameAr : selectedService.nameEn}
              </p>
              <p className="mt-1 font-semibold text-blue-600">
                {isArabic ? selectedPlan.nameAr : selectedPlan.nameEn} —{' '}
                {selectedPlanPrice}
              </p>
            </div>

            <button
              onClick={requestService}
              disabled={requestDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
              {loading
                ? isArabic
                  ? 'جاري إرسال الطلب...'
                  : 'Sending request...'
                : isArabic
                ? 'إرسال الطلب للإدارة'
                : 'Send Request to Admin'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <BriefcaseBusiness className="mt-1 h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold">
              {isArabic ? 'ماذا يحدث بعد إرسال الطلب؟' : 'What happens next?'}
            </h2>
            <p className="mt-2 leading-8 text-gray-600">
              {isArabic
                ? 'بعد إرسال الطلب، ستقوم الإدارة بمراجعته. إذا تمت الموافقة عليه سيظهر داخل خدماتك، وإذا تم رفضه سيظهر سبب الرفض.'
                : 'After sending the request, the admin will review it. If it is accepted, it will appear in your services. If it is refused, you will see the refusal reason.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};