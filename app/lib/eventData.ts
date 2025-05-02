interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  time: string;
}

interface EventsByDate {
  [date: string]: Event[];
}

const events: EventsByDate = {
  "2024-03-11": [
    {
      id: "event-1",
      title: "Coffee with Alex",
      description: "Meet with Alex to brainstorm ideas for the upcoming product launch. We'll review market research and competitor analysis to identify potential opportunities and challenges.",
      imageUrl: "https://fastly.picsum.photos/id/312/1920/1080.jpg?hmac=OD_fP9MUQN7uJ8NBR7tlii78qwHPUROGgohG4w16Kjw",
      time: "09:00 AM",
    },
    {
      id: "event-2",
      title: "Team Standup",
      description: "Weekly standup meeting with the dev team. Discuss progress, blockers, and align on next week's priorities.",
      imageUrl: "http://fastly.picsum.photos/id/737/1920/1080.jpg?hmac=aFzER8Y4wcWTrXVx2wVKSj10IqnygaF33gESj0WGDwI",
      time: "02:00 PM",
    },
    {
      id: "event-6",
      title: "Chennai Expo Setup",
      description: "Final preparations and booth setup for the Chennai Expo starting tomorrow.",
      imageUrl: "https://www.aristo-india.com/assets/images/events/chennai-expo-2023/aristo-india-bangalore-events-at-chennai-expo-2023-1.jpg",
      time: "04:00 PM",
    },
  ],
  "2024-03-12": [
    {
      id: "event-3",
      title: "Yoga Session",
      description: "Join for a relaxing yoga session to reduce stress and improve mindfulness. Suitable for all levels, focusing on gentle stretches.",
      imageUrl: "https://fastly.picsum.photos/id/392/1920/1080.jpg?hmac=Fvbf7C1Rcozg8EccwYPqsGkk_o6Bld2GQRDPZKWpd7g",
      time: "12:00 PM",
    },
    {
      id: "event-4",
      title: "Product Demo",
      description: "Demo of UI improvements and performance optimizations to gather stakeholder feedback.",
      imageUrl: "https://images.jdmagicbox.com/comp/ernakulam/m4/0484px484.x484.140206113128.a9m4/catalogue/we-create-events-panampilly-nagar-ernakulam-event-management-companies-nsobpzm660.jpg?clr=",
      time: "03:30 PM",
    },
    {
      id: "event-7",
      title: "Design Training",
      description: "Internal training session on sliding wardrobe design principles and best practices.",
      imageUrl: "https://www.aristo-india.com/assets/images/training/aristo-india-bangalore-sliding-wardrobe-design-training-programs-11.jpg",
      time: "10:00 AM",
    },
    {
      id: "event-8",
      title: "Special Event Planning",
      description: "Meeting to discuss logistics for the upcoming Hayward special event.",
      imageUrl: "https://www.hayward-ca.gov/sites/default/files/pictures/Special-Events-Guide.svg",
      time: "01:30 PM",
    },
  ],
  "2024-03-13": [
    {
      id: "event-5",
      title: "Client Meeting",
      description: "Review project progress, timeline adjustments, and outline roadmap for next quarter with the client.",
      imageUrl: "https://4.imimg.com/data4/WE/YY/MY-13164308/event-management-service.jpgs",
      time: "11:30 AM",
    },
    {
      id: "event-9",
      title: "Makers Tribe Meetup",
      description: "Attend the local Makers Tribe event to network and see latest projects.",
      imageUrl: "https://makerstribe.in/wp-content/uploads/2024/01/cfs-event-footer.webp",
      time: "06:00 PM",
    },
    {
      id: "event-10",
      title: "California Event Brainstorm",
      description: "Creative session to brainstorm unique event ideas for the Visit California campaign.",
      imageUrl: "https://drupal-prod.visitcalifornia.com/sites/default/files/styles/fluid_1920/public/2022-01/VC_BestOfCA2022_Unique-Events_SUPPLIED_1280x640.jpg.webp?itok=lndHfVXS",
      time: "02:00 PM",
    },
  ],
  "2024-03-14": [
    {
      id: "event-11",
      title: "PCMA Conference Call",
      description: "Discuss industry trends and upcoming PCMA events.",
      imageUrl: "https://www.pcma.org/wp-content/uploads/2018/10/trillion-main.jpg",
      time: "09:30 AM",
    },
    {
      id: "event-12",
      title: "Hawaii Festival Planning",
      description: "Coordinate logistics for the annual Go Hawaii festival.",
      imageUrl: "https://www.gohawaii.com/sites/default/files/styles/image_gallery_bg_xl/public/hero-unit-images/MH_01065-Annual%20Events%20and%20Festivals.jpg.webp?itok=XlyZBmhe",
      time: "11:00 AM",
    },
    {
      id: "event-13",
      title: "Fireworks Display Review",
      description: "Safety and logistics review for the upcoming fireworks display.",
      imageUrl: "https://thehawaiiadmirer.com/wp-content/uploads/2019/04/hawaii-events-fireworks-1150x605.jpg",
      time: "04:00 PM",
    },
  ]
};

export default events;
export type { Event, EventsByDate }; 