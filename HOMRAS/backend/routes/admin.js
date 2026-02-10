// backend/routes/admin.js
const express = require('express');
const router = express.Router();

// ადმინის ავტორიზაცია
router.post('/login', (req, res) => {
  res.json({ 
    success: true,
    message: 'Admin logged in successfully',
    token: 'dummy-jwt-token-for-now',
    user: {
      id: 1,
      name: 'Administrator',
      email: 'admin@homras.ge',
      role: 'admin'
    }
  });
});

// დეშბორდის სტატისტიკა
router.get('/stats', (req, res) => {
  res.json({
    totalUsers: 125,
    totalHandymen: 47,
    totalJobs: 189,
    avgRating: 4.7,
    dailyJobs: 12,
    jobStats: {
      labels: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ'],
      data: [12, 19, 8, 15, 22, 18]
    },
    categoryStats: {
      labels: ['ელექტრიკა', 'სანტექნიკა', 'სამშენებლო', 'დასუფთავება', 'სხვა'],
      data: [25, 20, 30, 15, 10]
    }
  });
});

// აქტივობები
router.get('/activities', (req, res) => {
  res.json([
    {
      id: 1,
      type: 'user_registered',
      title: 'ახალი მომხმარებელი',
      description: 'გიორგი მაისურაძე დარეგისტრირდა',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 2,
      type: 'job_created',
      title: 'ახალი სამუშაო',
      description: 'დაიწყო სამზარეულოს რემონტის სამუშაო',
      timestamp: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 3,
      type: 'handyman_registered',
      title: 'ახალი ხელოსანი',
      description: 'ნიკოლოზ ხომერიკი დარეგისტრირდა როგორც ელექტრიკოსი',
      timestamp: new Date(Date.now() - 10800000).toISOString()
    },
    {
      id: 4,
      type: 'review_added',
      title: 'ახალი რეცენზია',
      description: 'მარიამ ბერიძემ დატოვა 5-ვარსკვლავიანი რეცენზია',
      timestamp: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: 5,
      type: 'payment_received',
      title: 'გადახდა მიღებულია',
      description: 'გადახდა მიღებულია სამზარეულოს რემონტისთვის (₾450)',
      timestamp: new Date(Date.now() - 18000000).toISOString()
    }
  ]);
});

// მომხმარებლები
router.get('/users', (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  
  const users = [
    {
      id: 1,
      fullName: 'გიორგი მაისურაძე',
      username: 'giorgi123',
      email: 'giorgi@example.com',
      phone: '555-123456',
      isActive: true,
      createdAt: '2023-10-15T10:30:00.000Z'
    },
    {
      id: 2,
      fullName: 'მარიამ ბერიძე',
      username: 'mariam_b',
      email: 'mariam@example.com',
      phone: '555-654321',
      isActive: true,
      createdAt: '2023-10-10T14:20:00.000Z'
    },
    {
      id: 3,
      fullName: 'ნიკა ყურაშვილი',
      username: 'nika_q',
      email: 'nika@example.com',
      phone: '555-987654',
      isActive: false,
      createdAt: '2023-10-05T09:15:00.000Z'
    }
  ];
  
  res.json({
    users: users.slice((page - 1) * limit, page * limit),
    totalPages: 1,
    currentPage: parseInt(page),
    totalUsers: users.length
  });
});

// ხელოსნები
router.get('/handymen', (req, res) => {
  const { filter = 'all', page = 1, limit = 10 } = req.query;
  
  const handymen = [
    {
      id: 1,
      fullName: 'ნიკოლოზ ხომერიკი',
      email: 'nikoloz@example.com',
      specialization: 'ელექტრიკოსი',
      avgRating: 4.9,
      totalReviews: 24,
      completedJobs: 47,
      status: 'verified'
    },
    {
      id: 2,
      fullName: 'ლევან ტურაშვილი',
      email: 'levani@example.com',
      specialization: 'სანტექნიკოსი',
      avgRating: 4.7,
      totalReviews: 18,
      completedJobs: 32,
      status: 'verified'
    },
    {
      id: 3,
      fullName: 'დავით გაბუნია',
      email: 'david@example.com',
      specialization: 'სამშენებლო სამუშაოები',
      avgRating: 4.5,
      totalReviews: 12,
      completedJobs: 21,
      status: 'pending'
    }
  ];
  
  res.json({
    handymen: handymen.slice((page - 1) * limit, page * limit),
    pendingCount: handymen.filter(h => h.status === 'pending').length
  });
});

// სამუშაოები
router.get('/jobs', (req, res) => {
  const jobs = [
    {
      id: 1,
      title: 'სამზარეულოს რემონტი',
      category: 'სამშენებლო',
      clientName: 'გიორგი მაისურაძე',
      handymanName: 'დავით გაბუნია',
      price: 450,
      status: 'completed',
      createdAt: '2023-11-10T09:00:00.000Z'
    },
    {
      id: 2,
      title: 'ელექტრო ტაბლეტის შეკეთება',
      category: 'ელექტრიკა',
      clientName: 'მარიამ ბერიძე',
      handymanName: 'ნიკოლოზ ხომერიკი',
      price: 120,
      status: 'active',
      createdAt: '2023-11-12T14:30:00.000Z'
    },
    {
      id: 3,
      title: 'ტუალეტის გადაკეთება',
      category: 'სანტექნიკა',
      clientName: 'ნიკა ყურაშვილი',
      handymanName: 'ლევან ტურაშვილი',
      price: 280,
      status: 'pending',
      createdAt: '2023-11-14T11:15:00.000Z'
    }
  ];
  
  res.json({ jobs });
});

// რეცენზიები
router.get('/reviews', (req, res) => {
  const reviews = [
    {
      id: 1,
      clientName: 'მარიამ ბერიძე',
      handymanName: 'ნიკოლოზ ხომერიკი',
      rating: 5,
      comment: 'ძალიან პროფესიონალური მუშაობა, რეკომენდაციას ვუწევ!',
      createdAt: '2023-11-11T16:45:00.000Z',
      reported: false
    },
    {
      id: 2,
      clientName: 'გიორგი მაისურაძე',
      handymanName: 'დავით გაბუნია',
      rating: 4,
      comment: 'კარგად შეასრულა სამუშაო, მაგრამ ოდნავ გადააჭარბა დედლაინს',
      createdAt: '2023-11-09T12:20:00.000Z',
      reported: false
    }
  ];
  
  res.json({ reviews });
});

// შეტყობინებები
router.get('/messages/conversations', (req, res) => {
  res.json({
    conversations: [
      {
        id: 1,
        participantName: 'გიორგი მაისურაძე',
        lastMessage: 'როდის მოდიხართ?',
        lastMessageTime: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        participantName: 'ნიკოლოზ ხომერიკი',
        lastMessage: 'დავასრულე სამუშაო, შემოგირჩეთ ინვოისი',
        lastMessageTime: new Date(Date.now() - 7200000).toISOString()
      }
    ]
  });
});

// ანგარიშები
router.get('/reports', (req, res) => {
  res.json({
    transactions: [
      {
        id: 1,
        date: '2023-11-10',
        clientName: 'გიორგი მაისურაძე',
        handymanName: 'დავით გაბუნია',
        service: 'სამზარეულოს რემონტი',
        amount: 450,
        status: 'completed'
      },
      {
        id: 2,
        date: '2023-11-08',
        clientName: 'მარიამ ბერიძე',
        handymanName: 'ნიკოლოზ ხომერიკი',
        service: 'ელექტრო ტაბლეტი',
        amount: 120,
        status: 'completed'
      }
    ],
    revenue: {
      labels: ['კვირა 1', 'კვირა 2', 'კვირა 3', 'კვირა 4'],
      data: [1200, 1900, 1500, 2100]
    },
    topHandymen: [
      {
        fullName: 'ნიკოლოზ ხომერიკი',
        specialization: 'ელექტრიკოსი',
        avgRating: 4.9,
        completedJobs: 47
      },
      {
        fullName: 'ლევან ტურაშვილი',
        specialization: 'სანტექნიკოსი',
        avgRating: 4.7,
        completedJobs: 32
      },
      {
        fullName: 'დავით გაბუნია',
        specialization: 'სამშენებლო',
        avgRating: 4.5,
        completedJobs: 21
      }
    ]
  });
});

// ცვლილებების შენახვა
router.put('/settings/general', (req, res) => {
  res.json({ success: true, message: 'ზოგადი პარამეტრები შენახულია' });
});

router.put('/settings/commission', (req, res) => {
  res.json({ success: true, message: 'საკომისიო პარამეტრები შენახულია' });
});

router.put('/settings/notifications', (req, res) => {
  res.json({ success: true, message: 'შეტყობინებების პარამეტრები შენახულია' });
});

router.put('/settings/security', (req, res) => {
  res.json({ success: true, message: 'უსაფრთხოების პარამეტრები შენახულია' });
});

// ანგარიშის გენერაცია
router.post('/reports/generate', (req, res) => {
  res.json({ success: true, message: 'ანგარიში გენერირდა' });
});

// ექსპორტი
router.get('/users/export', (req, res) => {
  res.json({ 
    success: true, 
    downloadUrl: '/api/admin/export/users.csv',
    message: 'ექსპორტი მზადაა' 
  });
});

// სტატუსი
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;