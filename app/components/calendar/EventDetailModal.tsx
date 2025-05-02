"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { EventDetailModalProps } from "@/app/types/calendar";

const EventDetailModal = ({
  event,
  isOpen,
  onClose,
  originRect,
}: EventDetailModalProps) => {
  if (!isOpen || !event) {
    return null; // Don't render anything if not open or no event
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-[9999]"
          initial={{
            backgroundColor: "rgba(0, 0, 0, 0)",
            backdropFilter: "blur(0px)",
          }}
          animate={{
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
          }}
          exit={{
            backgroundColor: "rgba(0, 0, 0, 0)",
            backdropFilter: "blur(0px)",
            transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
          }}
          transition={{
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            className="bg-white w-full h-full overflow-hidden fixed top-0 left-0"
            style={{
              originX: originRect
                ? (originRect.x + originRect.width / 2) / window.innerWidth
                : 0.5,
              originY: originRect
                ? (originRect.y + originRect.height / 2) / window.innerHeight
                : 0.5,
            }}
            initial={{
              borderRadius: "12px",
              x: originRect?.x || 0,
              y: originRect
                ? originRect.y - window.scrollY + originRect.scrollY
                : 0,
              width: originRect?.width || "100%",
              height: originRect?.height || "100%",
              opacity: originRect ? 1 : 0, // Start transparent if no origin
              boxShadow: "0 0 0 rgba(0,0,0,0)",
            }}
            animate={{
              borderRadius: 0,
              x: 0,
              y: 0,
              width: "100%",
              height: "100%",
              opacity: 1,
              boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
            }}
            exit={{
              borderRadius: "12px",
              x: originRect?.x || 0,
              y: originRect
                ? originRect.y - window.scrollY + originRect.scrollY
                : 0, // Adjusted Y calculation
              width: originRect?.width || 0,
              height: originRect?.height || 0,
              opacity: 0,
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              mass: 0.85,
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
          >
            <motion.div
              className="h-full w-full overflow-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero header section */}
              <div
                className="relative w-full overflow-hidden"
                style={{ height: event.imageUrl ? "45vh" : "35vh" }}
              >
                {event.imageUrl ? (
                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0.7 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.7 }}
                    transition={{ duration: 0.6 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${event.imageUrl})` }}
                      initial={{
                        scale: 1.1,
                        filter: "brightness(0.8) saturate(0.9)",
                      }}
                      animate={{
                        scale: 1.05,
                        filter: "brightness(0.9) saturate(1.1)",
                      }}
                      exit={{
                        scale: 1.15,
                        filter: "brightness(0.8) saturate(0.9)",
                        transition: { duration: 0.6 },
                      }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.3 }}
                      transition={{ duration: 0.8 }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800"
                    initial={{
                      opacity: 0.8,
                      background:
                        "linear-gradient(to bottom right, #2563eb, #4338ca)",
                    }}
                    animate={{
                      opacity: 1,
                      background:
                        "linear-gradient(to bottom right, #3b82f6, #4f46e5)",
                    }}
                    exit={{
                      opacity: 0.8,
                      background:
                        "linear-gradient(to bottom right, #2563eb, #4338ca)",
                    }}
                    transition={{ duration: 0.8 }}
                  />
                )}

                {/* Title and time info */}
                <motion.div
                  className="absolute bottom-0 left-0 w-full p-6 pb-8 text-white"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: 20,
                    transition: { duration: 0.25, ease: "easeIn" },
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.15,
                  }}
                >
                  <motion.div
                    className="flex items-center gap-2 text-white/90 mb-2 text-sm"
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      y: 10,
                      scale: 0.95,
                      transition: { duration: 0.2, ease: "easeIn" },
                    }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.25,
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <span>{event.time}</span>
                    <span className="mx-1">•</span>
                    <span>{event.date}</span>
                  </motion.div>
                  <motion.h1
                    className="text-3xl font-bold text-white"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      y: 15,
                      scale: 0.95,
                      transition: { duration: 0.2, ease: "easeIn" },
                    }}
                    transition={{
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.35,
                    }}
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
                  >
                    {event.title}
                  </motion.h1>
                </motion.div>

                {/* Close button */}
                <motion.button
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white"
                  onClick={onClose}
                  initial={{ opacity: 0, y: -20, scale: 0.8, rotate: -90 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  exit={{
                    opacity: 0,
                    y: -15,
                    scale: 0.8,
                    rotate: -90,
                    transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] },
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.5,
                  }}
                  style={{
                    backdropFilter: "blur(3px)",
                    WebkitBackdropFilter: "blur(3px)",
                  }}
                  whileHover={{
                    scale: 1.1,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    boxShadow: "0 0 20px rgba(0,0,0,0.2)",
                  }}
                  whileTap={{ scale: 0.9 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* Content area */}
              <div className="p-6 px-8 bg-white">
                <motion.div
                  className="mb-8"
                  initial={{ opacity: 0, y: 40, x: -10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{
                    opacity: 0,
                    y: 30,
                    x: -5,
                    transition: { duration: 0.25, ease: "easeIn" },
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.45,
                  }}
                >
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">
                    Description
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {event.description ||
                      "No description available for this event."}
                  </p>
                </motion.div>

                {/* Location */}
                <motion.div
                  className="mb-8"
                  initial={{ opacity: 0, y: 45, x: -10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{
                    opacity: 0,
                    y: 35,
                    x: -5,
                    transition: { duration: 0.25, ease: "easeIn" },
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.55,
                  }}
                >
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">
                    Location
                  </h2>
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100">
                    <div className="bg-blue-100 text-blue-500 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s-8-4.5-8-11.8a8 8 0 0 1 16 0c0 7.3-8 11.8-8 11.8z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <span className="text-gray-700">
                      Meeting Room {Math.floor(Math.random() * 10) + 1}
                    </span>
                  </div>
                </motion.div>

                {/* Action buttons */}
                <motion.div
                  className="flex gap-3 pt-4 border-t border-gray-200"
                  initial={{ opacity: 0, y: 50, x: -10 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{
                    opacity: 0,
                    y: 40,
                    x: -5,
                    transition: { duration: 0.25, ease: "easeIn" },
                  }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.65,
                  }}
                >
                  <motion.button
                    className="flex-1 py-3.5 px-4 bg-gray-100 rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2"
                    onClick={onClose}
                    whileHover={{
                      backgroundColor: "#e5e7eb",
                      scale: 1.02,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EventDetailModal;
