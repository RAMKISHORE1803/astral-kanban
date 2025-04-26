"use client";

import { motion, AnimatePresence } from "framer-motion";
import { KanbanEvent, formatDate } from "@/app/lib/utils";
import Button from "../ui/Button";

interface EventDetailProps {
  event: KanbanEvent | null;
  onClose: () => void;
  onEdit: (event: KanbanEvent) => void;
  onDelete: (eventId: string) => void;
}

const EventDetail = ({ event, onClose, onEdit, onDelete }: EventDetailProps) => {
  if (!event) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-white rounded-astral-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="relative">
            {event.imageUrl && (
              <div className="w-full h-48 bg-gray-200 rounded-t-astral-lg overflow-hidden">
                <img
                  src={event.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-white/80 p-2 rounded-full shadow-sm hover:bg-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 mr-4">{event.title}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-astral-blue">Time</h3>
                <p className="text-slate-600">
                  {formatDate(new Date(event.date))}
                </p>
                <p className="text-slate-600">
                  {event.time}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-astral-blue">Description</h3>
                <p className="text-slate-600 whitespace-pre-line">
                  {event.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <Button
                  variant="secondary"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onDelete(event.id)}
                >
                  Delete
                </Button>
                <div className="space-x-2">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  <Button onClick={() => onEdit(event)}>Edit</Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EventDetail; 